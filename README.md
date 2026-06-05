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

After the header, use one vocabulary item per line:

```text
type / source / target / optional details & ignored text
```

Minimum:

```text
? / es / en
type / source / target
```

Type codes:

```text
1 noun
2 verb
3 adjective
4 adverb
5 phrase
6 other
```

Everything after the first `&` is ignored and not saved as notes. Use `/` only as the field separator.

## AI Vocabulary File Generation Guide

Use this prompt with ChatGPT, Gemini, or another AI. Replace `es`, `en`, and the topic before sending it:

```text
Generate a clean import file for Vocab Trainer 101.

Topic/level: everyday beginner vocabulary
Source language code: es
Target language code: en
Number of vocabulary items: 40

Output rules:
- Return plain text only.
- Do not add a title, explanation, markdown, bullets, numbering, tables, or code fences.
- The first line must be exactly:
? / es / en
- Every following line must use exactly this slash-delimited structure:
type / source / target / optional details
- The first three vocabulary fields are required on every vocabulary line.
- Use `/` only as the field separator.
- Do not use `/` inside any field.
- Use `&` only after the importable content, before examples or comments that should be ignored by the app.
- Everything after the first `&` will be ignored by the app.

Type codes:
1 noun
2 verb
3 adjective
4 adverb
5 phrase
6 other

Content rules:
- Keep every line unique by type, source, and target.
- Avoid near-duplicates where any two of type, source, and target are the same.
- Details are optional for nouns, adjectives, adverbs, phrases, and other items.
- For verbs, put conjugations in the fourth field using this exact tense order:
  present: ...; future: ...; preterite: ...
- For verbs, include six common forms in each tense.
- Do not put examples before `&`.
- Keep the source field natural, with articles for nouns when useful.
- Keep translations concise and natural.

Example of the required output shape:
? / es / en
1 / la casa / house
2 / hablar / to speak / present: hablo hablas habla hablamos habláis hablan; future: hablaré hablarás hablará hablaremos hablaréis hablarán; preterite: hablé hablaste habló hablamos hablasteis hablaron
5 / buenos días / good morning
```

Good examples:

```text
? / es / en
1 / casa / house
1 / el año / the year
2 / hablar / to speak / present: hablo hablas habla hablamos habláis hablan; future: hablaré hablarás hablará hablaremos hablaréis hablarán; preterite: hablé hablaste habló hablamos hablasteis hablaron & regular verb; example ignored by app
2 / ir / to go / present: voy vas va vamos vais van; future: iré irás irá iremos iréis irán; preterite: fui fuiste fue fuimos fuisteis fueron & irregular
3 / rápido / fast / describes speed
4 / lentamente / slowly
5 / buenos días / good morning
6 / ojalá / hopefully
```

Bad examples:

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
2 / hablar / to talk
```

PDF imports require selectable text. Scanned/image-only PDFs are not supported in this version.

Current sample file:

```text
outputs/sample_current_vocabulary_list.txt
```
