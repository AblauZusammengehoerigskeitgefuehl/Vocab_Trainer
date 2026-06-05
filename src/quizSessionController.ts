// @ts-nocheck
import {
  canShowVerbDetails,
  dedupeEligibleEntries,
  entryKey,
  makeQuizSession,
  nowIso,
  quizItemForEntry,
} from "./core.js";

export class QuizSessionController {
  constructor(context) {
    this.context = context;
    this.state = context.state;
    this.vocabRepo = context.vocabRepo;
    this.quizRepo = context.quizRepo;
  }

  async start() {
    if (!this.state.quizConfig.datasetIds.length) {
      this.state.message = "No cards match the current filters.";
      return;
    }
    const entries = await this.vocabRepo.getByDatasetIds(this.state.quizConfig.datasetIds);
    const session = makeQuizSession({ ...this.state.quizConfig, languagePairId: this.state.activeLanguagePairId }, entries);
    if (!session.queue.length) {
      this.state.message = entries.some((entry) => entry.masteryCount >= 5)
        ? "All selected words are mastered. Enable Include mastered to practice them again."
        : "No cards match the current filters.";
      return;
    }
    await this.quizRepo.save(session);
    this.state.quizFocusMode = true;
  }

  async updateQueue() {
    const session = this.state.quizSession;
    if (!session) return;
    const entries = await this.vocabRepo.getByDatasetIds(this.state.quizConfig.datasetIds);
    const eligible = dedupeEligibleEntries(entries, this.state.quizConfig, session.sessionScores);
    const existingByKey = new Map(session.queue.map((item) => [item.entryKey, item]));
    const queue = eligible.map((entry) => {
      const existing = existingByKey.get(entryKey(entry));
      if (!existing) return quizItemForEntry(entry, this.state.quizConfig.direction);
      return {
        ...existing,
        direction: this.directionForUpdatedItem(existing, this.state.quizConfig.direction),
        revealLevel: 0,
        verbTranslationResult: undefined,
        verbDetailsResult: undefined,
      };
    });
    if (!queue.length) {
      this.state.message = entries.some((entry) => entry.masteryCount >= 5)
        ? "All selected words are mastered. Enable Include mastered to practice them again."
        : "No cards match the current filters.";
    }
    const updated = {
      ...session,
      languagePairId: this.state.activeLanguagePairId,
      selectedDatasetIds: this.state.quizConfig.datasetIds,
      direction: this.state.quizConfig.direction,
      includeMastered: this.state.quizConfig.includeMastered,
      typeFilters: this.state.quizConfig.typeFilters,
      queue,
      currentItemId: queue.some((item) => item.id === session.currentItemId) ? session.currentItemId : queue[0]?.id,
      sessionScores: { ...Object.fromEntries(queue.map((item) => [item.entryKey, 0])), ...session.sessionScores },
      roundSeenEntryKeys: (session.roundSeenEntryKeys ?? []).filter((key) => queue.some((item) => item.entryKey === key)),
      updatedAt: nowIso(),
    };
    await this.quizRepo.save(updated);
    this.state.quizSession = updated;
  }

  async finish() {
    if (!confirm("Finish quiz? Current session scores will reset.")) return;
    this.state.quizFocusMode = false;
    await this.quizRepo.clearActive();
  }

  async revealCurrent() {
    const session = this.state.quizSession;
    const item = this.currentItem();
    if (!session || !item) return;
    const entry = this.state.entries.find((candidate) => candidate.id === item.entryId);
    if (entry && canShowVerbDetails(entry)) {
      if (item.revealLevel === 0) {
        item.verbTranslationResult = "-";
        item.revealLevel = 1;
        await this.quizRepo.save(session);
        return;
      }
      if (item.revealLevel === 1) {
        item.verbDetailsResult = "-";
        item.pendingResult = "-";
        item.revealLevel = 2;
        await this.quizRepo.save(session);
        return;
      }
      await this.applyFinalScore(item, "-");
      return;
    }
    if (entry && !canShowVerbDetails(entry) && item.revealLevel === 0) {
      item.revealLevel = 1;
      item.pendingResult = "-";
      await this.quizRepo.save(session);
      return;
    }
    await this.applyFinalScore(item, item.pendingResult ?? "-");
  }

  async markVerbTranslation(result) {
    const session = this.state.quizSession;
    const item = this.currentItem();
    if (!session || !item) return;
    item.verbTranslationResult = result;
    item.revealLevel = 2;
    await this.quizRepo.save(session);
  }

  async markVerbDetails(result) {
    const session = this.state.quizSession;
    const item = this.currentItem();
    if (!session || !item) return;
    if (item.pendingResult) {
      await this.applyFinalScore(item, item.pendingResult);
      return;
    }
    item.verbDetailsResult = result;
    item.revealLevel = 2;
    await this.finalizeCurrentVerbScore();
  }

  async scoreCurrent(result) {
    const session = this.state.quizSession;
    const item = this.currentItem();
    if (!session || !item) return;
    const entry = this.state.entries.find((candidate) => candidate.id === item.entryId);
    if (entry && canShowVerbDetails(entry) && item.pendingResult && item.revealLevel >= 2) {
      await this.applyFinalScore(item, item.pendingResult);
      return;
    }
    if (entry && !canShowVerbDetails(entry) && item.pendingResult && item.revealLevel >= 1) {
      await this.applyFinalScore(item, item.pendingResult);
      return;
    }
    if (entry && canShowVerbDetails(entry) && item.revealLevel === 0) {
      item.verbTranslationResult = result;
      item.revealLevel = 1;
      await this.quizRepo.save(session);
      return;
    }
    if (entry && canShowVerbDetails(entry) && item.revealLevel === 1) {
      item.verbDetailsResult = result;
      await this.finalizeCurrentVerbScore();
      return;
    }
    if (entry && canShowVerbDetails(entry) && item.revealLevel >= 2) {
      item.verbDetailsResult = result;
      await this.finalizeCurrentVerbScore();
      return;
    }
    await this.applyFinalScore(item, result);
  }

  async finalizeCurrentVerbScore() {
    const item = this.currentItem();
    if (!item?.verbTranslationResult || !item.verbDetailsResult) return;
    const finalResult = item.verbTranslationResult === "+" && item.verbDetailsResult === "+" ? "+" : "-";
    await this.applyFinalScore(item, finalResult);
  }

  async applyFinalScore(item, finalResult) {
    const session = this.state.quizSession;
    if (!session || !item) return;
    const entry = this.state.entries.find((candidate) => candidate.id === item.entryId);
    const nextScore = (session.sessionScores[item.entryKey] ?? 0) + (finalResult === "+" ? 1 : -1);
    session.sessionScores[item.entryKey] = nextScore;
    session.roundSeenEntryKeys = [...new Set([...(session.roundSeenEntryKeys ?? []), item.entryKey])];
    if (nextScore >= 5 && entry) {
      const updatedEntries = this.state.entries
        .filter((candidate) => entryKey(candidate) === item.entryKey)
        .map((candidate) => ({
          ...candidate,
          masteryCount: (candidate.masteryCount ?? 0) + 1,
          updatedAt: nowIso(),
        }));
      for (const candidate of updatedEntries) await this.vocabRepo.updateEntry(candidate);
      updatedEntries.forEach((updated) => {
        const index = this.state.entries.findIndex((candidate) => candidate.id === updated.id);
        if (index >= 0) this.state.entries[index] = updated;
      });
      session.queue = session.queue.filter((candidate) => candidate.id !== item.id);
      session.roundSeenEntryKeys = session.roundSeenEntryKeys.filter((key) => session.queue.some((candidate) => candidate.entryKey === key));
    } else {
      item.revealLevel = 0;
      delete item.pendingResult;
      delete item.verbTranslationResult;
      delete item.verbDetailsResult;
      if (this.state.quizConfig.direction === "mixed") {
        item.direction = Math.random() > 0.5 ? "spanish-to-english" : "english-to-spanish";
      }
    }
    if (session.queue.length && session.roundSeenEntryKeys.length >= session.queue.length) {
      session.queue = this.shuffleQuizQueue(session.queue, session.queue.map((candidate) => candidate.id));
      if (this.state.quizConfig.direction === "mixed") {
        session.queue = session.queue.map((candidate) => ({
          ...candidate,
          direction: Math.random() > 0.5 ? "spanish-to-english" : "english-to-spanish",
        }));
      }
      session.roundSeenEntryKeys = [];
      session.currentItemId = session.queue[0]?.id;
    } else {
      session.currentItemId = this.nextItemId(session, item.id);
    }
    if (!session.queue.length) this.state.quizFocusMode = false;
    await this.quizRepo.save(session);
  }

  directionForUpdatedItem(item, directionMode) {
    if (directionMode === "mixed") return item.direction;
    return directionMode;
  }

  shuffleQuizQueue(queue, previousOrder = []) {
    if (queue.length <= 1) return [...queue];
    let shuffled = [...queue];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      shuffled = this.shuffleOnce(queue);
      if (!this.sameOrder(shuffled, previousOrder)) return shuffled;
    }
    return [...queue.slice(1), queue[0]];
  }

  shuffleOnce(queue) {
    const shuffled = [...queue];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  sameOrder(queue, previousOrder) {
    return queue.length === previousOrder.length && queue.every((item, index) => item.id === previousOrder[index]);
  }

  nextItemId(session, currentId) {
    if (!session.queue.length) return undefined;
    const currentIndex = session.queue.findIndex((item) => item.id === currentId);
    return session.queue[(currentIndex + 1 + session.queue.length) % session.queue.length]?.id ?? session.queue[0]?.id;
  }

  currentItem() {
    return this.state.quizSession?.queue.find((item) => item.id === this.state.quizSession.currentItemId)
      ?? this.state.quizSession?.queue[0];
  }
}
