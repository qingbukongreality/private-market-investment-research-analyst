---
name: investment-meeting-minutes
description: "Process an investment target's BP, introduction, meeting transcript and supplemental materials into a detailed, objective, template-compliant Chinese investment meeting memo without losing substantive interview facts. Use for VC/PE project interviews, roadshows, screening calls and follow-up diligence meetings that must follow the bundled meeting-minutes format."
---

# Investment Meeting Minutes

## Required outcome

In App mode, create only `<公司名>会议纪要YYYYMMDD.docx`. Perform transcript correction and Q&A reconstruction internally, then include the complete Q&A under `访谈记录`; do not create intermediate files.

Create separate `修正.docx` and `Q&A.docx` only when the user explicitly requests intermediate deliverables.

Treat the folder as the project boundary. Preserve all user inputs and unrelated files.

## Start-up checks

1. Locate the company folder and identify the BP, company introduction, original transcript, audio, and any prior output.
2. Read the BP before editing the transcript. Build a private term sheet of company names, people, products, technologies, customers, financial figures, financing and abbreviations.
3. If an original transcript exists, use it as the editing base. If only audio exists, use an available transcription capability first; otherwise explain that an original transcript is required.
4. Read `references/workflow-rules.md` completely before producing files.
5. Use the user-provided `会议纪要模板.docx` in the input root as the sole style authority for the final meeting memo.
6. Preserve paragraph breaks, speaker labels, timestamps and Q/A boundaries during text extraction. Never flatten a transcript into one continuous paragraph.
7. If source text exceeds a single model request, split it at speaker/timestamp or paragraph boundaries with a small overlap. Process every chunk in order and merge results without dropping boundary content.
8. Inspect visual content in introductions, BP/PDF, Word, PowerPoint and standalone images. In App mode, use the configured MiniMax `understand_image` capability as the primary reader for scanned pages, screenshots, organization charts, cap tables, equity-penetration diagrams, product diagrams and visual tables; use local OCR only as a fallback when vision is unavailable or fails. Feed the resulting visual analysis to the text model together with ordinary extracted text.
9. For equity and organization diagrams, require vision analysis to describe connector direction and hierarchy, not only OCR text. For product, process, architecture and data charts, require vision analysis to retain labels, parameters, units, legends, arrows, row/column relationships and stage qualifiers.

## Workflow

### 1. Correct the transcript

- Before correcting any transcript chunk, build one shared entity glossary from the BP, company introduction and team materials. At minimum record each person's standard name, role and supported forms of address such as `某博士` or `某总`, together with company, customer, product, technology and abbreviation spellings. Reuse the same glossary for every chunk.
- Cross-check ASR-rendered names and forms of address against that glossary. Correct `某某博士`, `某某总`, `某总`, `X博` and similar homophones only when pronunciation, conversational role and reference material agree. If they do not agree, retain the original form of address or mark the name as unconfirmed; never guess a person.
- The glossary is a correction aid only. Do not insert a BP person, title or fact into Q&A unless the interview itself refers to it.
- Preserve every speaker label, timestamp and substantive statement.
- Correct speech-recognition errors, punctuation, sentence boundaries, duplicated stutters, product names, English abbreviations, people, customers, units and figures.
- Use the BP only to resolve obvious recognition errors. Do not replace what the speaker actually said with BP claims.
- Do not summarize or silently delete information.
- When audio is available and a phrase materially affects facts, listen to the relevant segment if the environment supports it.
- Save as `修正.docx`.

### 2. Create detailed Q&A

- Treat Q&A as a faithful written transcript, not a summary. Walk from the first line to the last and retain every question, follow-up, confirmation question and new issue introduced inside an answer. Similar questions, short questions and repeated follow-ups may not be silently dropped or merged.
- Preserve the answer's original information order and nearly all substantive sentences: background, reasons, process, evidence, examples, comparisons, calculations, figures, entities, stages, conditions, exceptions and uncertainty. Remove only filler particles, greetings, stutters, empty repeated openings and repetition that adds no meaning.
- Process the corrected transcript from beginning to end in time order.
- Split long discussions into granular questions so technical explanations, examples, calculations, limitations and qualifiers remain visible.
- Preserve all effective information; remove only greetings, meaningless repetition and unusable filler.
- Do not compress a long interview into an executive summary. Compare the Q&A against the transcript topic by topic before saving.
- Do not add a final generic question such as “后续待核验事项有哪些”“后续尽调需要核实什么” or similar verification checklist.
- Format each pair as a separate `Q：` paragraph and `A：` paragraph, with no first-line indentation and one blank paragraph after every pair.
- Save as `Q&A.docx`.
- In App mode, retain this Q&A internally and append it directly to the final memo instead of saving a standalone file.
- Chunking is an internal implementation detail. Final Q&A must never mention `当前片段`, `本段`, `下一段生成`, `继续处理`, `下一个片段`, `以上内容`, `后续片段`, `剩余内容` or any similar generation/process wording. Remove any entire Q&A pair whose purpose is only to announce a chunk boundary.
- The desired style is a faithful edited transcript, not a compressed interview summary. A normal 60–120 minute substantive interview commonly requires dozens of Q&A pairs; never impose a fixed count, but treat a result with fewer than one granular pair per distinct question/follow-up as incomplete.
- When a speaker's answer covers several independently useful subjects, split it at the natural topic transition. Do not use one broad question such as “请介绍公司情况” to absorb company history, team, products, customers, financing and financials into a single answer.
- Keep the answer in coherent prose. Do not insert `【标签】`, Markdown bullets, numbered outlines or mini-headings inside Q or A. Preserve the original explanation order and use normal Chinese sentences and paragraphs.
- Convert speech into concise professional written Chinese. Remove greetings, `嗯/啊/呃`, repeated empty connectors, false starts and conversational scaffolding such as `我简单说一下`, `这个怎么讲`, `对吧`, `是这样的`. Preserve any fact, reasoning, uncertainty or sequence carried by the sentence.
- The completion pass restores omitted facts, not omitted speech habits. Never increase length by adding conversational filler, restating the question in the answer or repeating the same conclusion in different words.

### 3. Create the meeting memo

- Use the corrected transcript as the primary factual source and the BP as supplementary background.
- If transcript and BP conflict, use the transcript figure or stage. Do not describe the conflict-resolution process in the memo.
- Write objectively. Separate completed delivery, customer testing, expected orders, forecasts and long-term plans.
- Do not overstate “领先”“唯一”“垄断”“已量产”“已进入供应链” unless directly supported and appropriately qualified.
- Avoid promotional or absolute language even when it appears in a BP or management statement. Do not write `绝对龙头`, `完全垄断`, `国内唯一`, `遥遥领先`, `完全替代`, `必然爆发`, `确定性极强` or similar wording as an objective conclusion. Preserve the underlying fact with scope, stage and attribution, for example `公司表示其在LED PSS领域市场份额较高`, `已向部分客户交付`, or `在部分工序具备替代可能`.
- A numerical claim such as `接近100%` may be retained only with attribution (`据公司介绍/公司称`) and its exact application scope. Never turn it into `垄断` or `绝对龙头`.
- Avoid drafting-process phrases such as “录音提到”“根据简介”“会前材料显示”“管理层口径”“Q&A显示”. State the fact naturally or attribute it to the company only when needed.
- Follow the exact section order and formatting in `references/workflow-rules.md`. Do not add independent sections that the template does not contain.
- Append the final user-approved `Q&A.docx` under `访谈记录` without rewriting or restoring deleted questions.
- In App mode, append the internally reconstructed Q&A exactly as produced by the chronological Q&A pass.
- Match the house style represented by the Word template: the topical body is a restrained factual synthesis, while detailed explanations, examples, parameters and follow-ups remain fully visible in `访谈记录`.
- Each topical subsection should normally use a small number of coherent prose paragraphs. Do not turn the body into a product catalog, due-diligence checklist or slide-style outline.
- Do not use square-bracket labels such as `【LED市场】`, `【技术壁垒】` or `【历史融资】`. Do not use Markdown `-` bullets or numbered sublists inside body paragraphs. Introduce subtopics naturally, for example “LED方面，……”“AR方面，……”.
- Avoid excessive product-model enumeration in the topical body. Retain representative product types and material facts there; keep the complete model/parameter discussion in Q&A.

### 4. Enforce completeness

- Completeness takes priority over brevity. Do not interpret “meeting memo” as an executive summary.
- Build a private coverage ledger from the transcript before drafting. Track each substantive topic, question, named customer, product/model, technical parameter, amount, percentage, date, milestone, comparison, forecast and qualifier.
- After drafting, compare the memo and Q&A against the ledger. Every item must be present, deliberately consolidated without loss of meaning, or marked unusable because the source itself is unclear.
- Do not merge distinct questions merely because they share a topic. Preserve follow-up questions when they introduce a new fact, limitation, calculation, example or qualification.
- If the Q&A or topical body is materially shorter than the information-bearing source, perform one missing-information pass before writing the DOCX. Character ratio is only a warning signal: never discard the full meeting solely because a fixed length threshold is missed.
- For long interviews, Q&A must be generated chunk by chunk along transcript boundaries and concatenated in order. A single full-transcript request is not an acceptable completeness strategy merely because the model context window is large.
- Compare the final Q&A against the transcript using both topic coverage and rough information density. If a detailed transcript produces fewer than half as many substantive Q&A transitions as are evident in the source, rerun only the deficient chunks rather than accepting the output.
- Count alone is not completeness. If the number of Q&A pairs is adequate but answers are materially shorter than the substantive source, rerun the deficient chunk with the source and draft together, restoring explanations, examples, calculations and qualifiers. App mode should reject a chunk that remains obviously compressed after one completion pass.
- Never solve an incomplete output by inventing details. Restore only facts supported by source material.
- Add OCR-derived names, ownership percentages, hierarchy, product labels, technical labels and table values to the coverage ledger. Preserve the source filename/page/image identifier so ambiguous chart relationships are not silently treated as certain.
- For equity or organization diagrams, reconstruct relationships only when the connector direction or hierarchy is unambiguous. Otherwise preserve the entities and percentages and mark the relationship as requiring confirmation.

## File and cleanup rules

- Put requested deliverables in the designated output folder. App mode outputs only the final memo.
- Do not leave builder scripts, extraction text, rendered pages, PDFs, contact sheets, intermediate DOCX files or temporary Python files in the company folder.
- If code is needed, create it only under a task-specific temporary directory and remove it after successful generation.
- Do not render DOCX files unless the user explicitly requests rendering or visual QA.
- Do not overwrite source BP, audio, introduction or original transcript.
- When revising a deliverable, update the established final filename instead of creating many versioned copies unless the user requests versions.

## Final validation

- Confirm internally corrected text retains all speaker/timestamp blocks when transcript correction is performed.
- Confirm every Q has one A, no first-line indentation, and one blank paragraph between pairs.
- Confirm Q&A contains no `【】`, Markdown bullets or outline numbering introduced by the model.
- Confirm Q&A contains no greetings, filler particles, false starts or model-added conversational transitions.
- Confirm promotional absolutes were removed or rewritten with explicit attribution, scope and stage.
- Confirm the topical body contains no `【】` labels and reads as normal investment-memo prose rather than a slide deck.
- Confirm Q&A covers financing, products, technology, customers, financials, strategy and every other topic actually discussed.
- Confirm the memo uses only the allowed Heading 1 and Heading 2 sequence.
- Confirm title and Q&A bolding match the template.
- Confirm no deleted Q&A question was restored.
- Confirm no temporary code or QA artifacts remain in the company folder.
- Confirm every coverage-ledger item is represented or explicitly classified as unusable source text.
- Confirm every relevant embedded or standalone image was inspected through OCR and that visual-only facts were included in the coverage check.
