# Vocab Trainer 101

Frontend-only vocabulary learning app with IndexedDB persistence and language-pair workspaces.

## Run

```sh
npm run build
python3 -m http.server 4173
```

Open `http://localhost:4173`.

The app stores language pairs, datasets, entries, invalid lines, duplicate conflicts, settings, mastery counts, and the active quiz session in IndexedDB. It does not use `localStorage` for main data.

## Import Format

Every import file must start with a language header:

```text
? / source-language-code / target-language-code
```

Example:

```text
? / es / en
```

After the header, use one vocabulary item per line.

For nouns, adjectives, adverbs, phrases, and other items:

```text
type / source / target / source-language usage sentence
```

For verbs:

```text
2 / source verb / target verb / conjugation / source-language usage sentence
```

The final field is saved as Details and should be a natural source-language sentence using the word. Do not use `&`; ampersands are invalid import syntax.

Type codes:

```text
1 noun
2 verb
3 adjective
4 adverb
5 phrase
6 other
```

Use `/` only as the field separator. Do not use `/` inside any field.

## AI Vocabulary File Generation Guide

Use this prompt with ChatGPT, Gemini, or another AI. Replace `es`, `en`, topic, and item count before sending it:

```text
Generate a clean downloadable .txt import file for Vocab Trainer 101.

Source language code: es
Target language code: en
Topic/level: everyday beginner vocabulary
Number of vocabulary items: 40
Output file name: vocab_trainer_101_import.txt

Return the result as a .txt file. If you cannot attach a file, return only the exact text content that should be saved inside vocab_trainer_101_import.txt.

The first line must be exactly:
? / es / en

The file must contain exactly 41 total lines:
- 1 header line
- exactly 40 vocabulary lines

Do not generate 39, 41, 42, or any other number of vocabulary lines.

Use these exact line formats.

For nouns, adjectives, adverbs, phrases, and other non-verb items:
type / source / target / source-language usage sentence

For verbs:
2 / source verb / target verb / present: ...; future: ...; preterite: ... / source-language usage sentence

Type codes:
1 noun
2 verb
3 adjective
4 adverb
5 phrase
6 other

Strict rules:
- Return plain text only.
- Do not add a title.
- Do not add explanations.
- Do not use markdown.
- Do not use code fences.
- Do not add bullets.
- Do not number the lines.
- Do not use tables or columns.
- Generate exactly the requested number of vocabulary items.
- The language header does not count as a vocabulary item.
- Count the vocabulary lines before finalizing the file.
- If the requested number is 40, there must be exactly 40 vocabulary lines after the header.
- Use `/` only as the field separator.
- Do not use `/` inside any field.
- Do not use `&` anywhere.
- Do not write `example:` anywhere.
- The final field is the Details field.
- Details must be only one natural sentence in the source language.
- The sentence must use the exact source word or phrase naturally.
- Do not translate the Details sentence.
- Do not write definitions, labels, grammar notes, or obvious descriptions in Details.
- Bad Details examples: "place to live", "common drink", "reading item", "describes size", "feminine noun", "regular verb".
- For non-verbs, use exactly 4 slash-separated fields.
- For verbs, use exactly 5 slash-separated fields.
- Keep every line unique by type, source, and target.
- Avoid near-duplicates where any two of type, source, and target are the same.
- Keep the source field natural.
- For nouns, include articles when the source language naturally uses them.
- Keep the target translation concise and natural.

Verb conjugation rules:
- For verbs, the fourth slash-separated field must contain conjugations only.
- Use this exact tense order:
  present: ...; future: ...; preterite: ...
- Include six common forms in each tense when the language has person-based conjugation.
- Do not put regular/irregular labels in the importable fields.
- Put the verb usage sentence only in the fifth field.

Example rules:
- Examples should be short and natural.
- Examples should be in the source language.
- Do not translate the example.
- Do not use `/` inside examples.

Required output shape:
? / es / en
1 / la casa / house / mi casa es pequeña
1 / el agua / water / bebo agua todos los días
2 / hablar / to speak / present: hablo hablas habla hablamos habláis hablan; future: hablaré hablarás hablará hablaremos hablaréis hablarán; preterite: hablé hablaste habló hablamos hablasteis hablaron / hablo español con mi amigo
2 / ir / to go / present: voy vas va vamos vais van; future: iré irás irá iremos iréis irán; preterite: fui fuiste fue fuimos fuisteis fueron / voy a casa después del trabajo
3 / rápido / fast / el coche rojo es rápido
4 / lentamente / slowly / camino lentamente por la calle
5 / buenos días / good morning / buenos días, Ana
6 / ojalá / hopefully / ojalá venga mañana

Now generate the .txt import file using the settings above.
Before finalizing, silently verify:
1. First line is exactly `? / es / en`.
2. There are exactly 40 vocabulary lines after the header.
3. Every non-verb line has exactly 4 slash-separated fields.
4. Every verb line has exactly 5 slash-separated fields.
5. No line contains `&`.
6. No line contains `example:`.
7. Every final field is a real source-language sentence, not a note or definition.
8. No line contains bullets, numbering, markdown, tables, or explanations.

Return only the final .txt file content.
```

## Good Examples

```text
? / es / en
1 / la casa / house / mi casa es pequeña
1 / el año / the year / el año termina pronto
2 / hablar / to speak / present: hablo hablas habla hablamos habláis hablan; future: hablaré hablarás hablará hablaremos hablaréis hablarán; preterite: hablé hablaste habló hablamos hablasteis hablaron / hablo español con mi amigo
2 / ir / to go / present: voy vas va vamos vais van; future: iré irás irá iremos iréis irán; preterite: fui fuiste fue fuimos fuisteis fueron / voy a casa después del trabajo
3 / rápido / fast / el coche rojo es rápido
4 / lentamente / slowly / camino lentamente por la calle
5 / buenos días / good morning / buenos días, Ana
6 / ojalá / hopefully / ojalá venga mañana
```

## Bad Examples

```text
Spanish Vocabulary List
1 / casa / house
- 1 / casa / house
1. casa / house
2 hablar to speak
2 / hablar
9 / hablar / to speak
2 / hablar / to speak / present: hablo/hablas/habla
2 / hablar / to speak
2 / hablar / to talk / present: hablo hablas habla hablamos habláis hablan; future: hablaré hablarás hablará hablaremos hablaréis hablarán; preterite: hablé hablaste habló hablamos hablasteis hablaron
1 / la casa / house / place to live
2 / hablar / to speak / present: hablo hablas habla hablamos habláis hablan; future: hablaré hablarás hablará hablaremos hablaréis hablarán; preterite: hablé hablaste habló hablamos hablasteis hablaron / regular verb
```

PDF imports require selectable text. Scanned/image-only PDFs are not supported in this version.

Current sample file:

```text
outputs/sample_current_vocabulary_list.txt
```
