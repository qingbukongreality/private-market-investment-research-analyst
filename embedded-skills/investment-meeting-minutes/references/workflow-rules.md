# Workflow and formatting rules

## Contents

1. Source priority
2. Transcript correction
3. Detailed Q&A
4. Meeting memo content
5. Exact Word structure
6. Validation checklist

## 1. Source priority

Use this order when facts differ:

1. Meeting audio.
2. Corrected/original transcript.
3. Company introduction supplied by the user.
4. BP.

Use the BP and company introduction as the primary spelling authority to correct names, roles, company names, product names and technical terms. Use the transcript as the authority for what was actually said in the meeting. Do not let BP claims overwrite interview facts, numbers, qualifications or uncertainty. Treat market size, future revenue, customer pipeline and technical leadership claims in the BP as company claims until verified.

For the topical body, meeting audio and transcript are not merely one source among several: they define the memo's factual storyline, emphasis and stage. BP, company introduction and supplements may correct spellings and add limited non-promotional background, but may not upgrade a meeting statement or fill silence with sales claims. If a claim appears only in the BP—especially market position, uniqueness, customer recognition, orders, performance, forecasts or technical superiority—omit it unless needed for context; when retained, label it as company-provided and state that the meeting did not independently confirm it. When BP and meeting conflict, write the meeting account in the memo and reserve the discrepancy for project-intake notes.

Text and visual elements inside the same source have equal source priority. Inspect embedded images, scanned pages, tables, organization charts and equity diagrams instead of reading only the document text layer. Keep the visual source locator with extracted facts. Do not infer an arrow direction, ownership chain or hierarchy that is not visually clear.

In App mode, MiniMax image understanding is the primary visual reader for every supported standalone image, relevant PDF page and Word/PowerPoint embedded image. Local OCR is a fallback, not a substitute for visual relationship analysis. The image prompt must be adapted to the visual type: ownership paths for equity charts, modules/arrows for technical diagrams, and row/column/year/unit structure for data tables.

## 2. Transcript correction

- Build a single name/title glossary from BP, company introduction and team materials before processing transcript chunks; reuse it across the full meeting so the same person is not written differently in different chunks.
- For names followed by `博士`, `总`, `老师`, `董` or similar address terms, require agreement among pronunciation, conversational role and the reference glossary before correction. When uncertain, preserve the address term or mark the name as pending confirmation rather than selecting the nearest-looking name.
- Reference materials may fix spelling but may not add a person, title or event that the interview did not mention.
- Retain title/date, speaker labels, timestamps and statement order.
- Do not convert the transcript into polished minutes at this stage.
- Repair obvious ASR errors in Chinese, English abbreviations, homophones, numbers and units.
- Normalize standard technical expressions such as product models, protocol names, company names and financing terms.
- Remove repeated syllables or stutters only when meaning is unchanged.
- Keep uncertainty when the audio itself is uncertain; do not invent the missing fact.
- Ensure corrected text length remains reasonably close to the original after removing only meaningless repetition.
- Preserve paragraph breaks and speaker/timestamp boundaries during extraction and correction. Flattening all text into a continuous paragraph is prohibited.
- For long transcripts, target about 3,000 Chinese characters per chunk and divide at the nearest natural speaker, timestamp or paragraph boundary. Use overlap at chunk boundaries and deduplicate only exact repeated boundary text after merging.

## 3. Detailed Q&A

### Coverage

Q&A is a faithful written rendering of the interview rather than a topic summary. Preserve every question and follow-up in sequence, including short confirmation questions and a new issue raised within an answer. Keep all substantive sentences in each answer and remove only oral noise or exact meaning-free repetition.

Walk the transcript sequentially. Typical topics include:

- meeting background and company history;
- team and organizational changes;
- product versions and roadmap;
- technical principles, differentiation and limitations;
- customer testing, qualification, orders and delivery;
- market size, competition and channel model;
- price, cost, gross margin and capacity;
- historical revenue, current revenue, expenses and cash needs;
- financing history, current round, valuation and use of proceeds;
- future strategy and long-term optionality.

Do not force topics that were not discussed.

### Detail standard

- Preserve examples, comparisons, assumptions, calculations and caveats.
- Split one long answer into several sequential Q&A pairs when it contains distinct issues.
- Explicitly distinguish actual orders from potential orders and actual revenue from targets.
- Keep the company's reasoning even when it is subjective, but label forecasts as forecasts.
- Never end with a generic verification/diligence checklist question. Verification belongs in internal analysis, not the Q&A artifact.
- Create a sequential coverage ledger before writing Q&A. At minimum, record every substantive question, follow-up, named entity, number, unit, date, product/model, technical parameter, customer stage, financing term, forecast and limitation.
- After drafting, compare the Q&A against this ledger. Do not impose a mandatory character-retention ratio or automatically run a second completion request solely because a chunk is short. Character count is only a review signal and never permission to pad text.
- Do not merge follow-ups that add a new fact, example, calculation, exception or qualification.
- Do not create omnibus questions that combine unrelated topics merely to reduce the number of Q&A pairs. Company history, team, product architecture, customers, market, financials and financing must remain separate when the conversation treats them separately.
- Q and A must be ordinary prose paragraphs. `【】` labels, Markdown bullets, numbered outlines and embedded mini-headings are prohibited.
- Edit answers into professional written Chinese. Remove greetings, filler particles, false starts, repeated empty connectors and conversational framing, while retaining every substantive fact, explanation, example and qualifier.
- A missing-information completion pass must never restore oral filler merely to increase length. Information density is measured by substantive content, not raw verbosity.

### Paragraph formatting

- `Q：...` is one paragraph.
- `A：...` is the next paragraph.
- Neither Q nor A has first-line indentation.
- Insert one empty Normal paragraph after every answer.
- Do not expose internal chunk boundaries. Remove process-only pairs and phrases such as `本段`, `当前片段`, `下一段生成`, `继续处理`, `后续片段` and `剩余内容` before writing the document.
- In standalone `Q&A.docx`, use the template's Normal font and size. Do not create a cover or decorative title.

## 4. Meeting memo content

Write a detailed factual synthesis before the appended Q&A. Use neutral language and calibrated stages. Concision means removing repetition and filler, not removing substantive facts:

The topical body is governed by a strict no-promotion rule. Use plain description and, where supported, critical framing. Do not decorate the company, team, technology, products, market position or prospects with evaluative adjectives or intensifying adverbs. Convert `技术先进`, `团队优秀`, `客户资源丰富`, `竞争力强`, `市场空间巨大` and similar claims into the underlying evidence, stage and limitation. If the material provides no observable support, omit the judgment. Do not manufacture criticism; every limitation or risk must follow from the supplied material.

- `已采购/已交付/已确认收入` only for completed facts.
- `已完成测试/正在测试/正在导入` for customer verification.
- `预计/目标/规划/可能` for forecasts.
- `公司认为/公司估算` for subjective market or technology judgments when attribution is necessary.
- Promotional absolutes are prohibited in narrator voice. Expressions such as `唯一`, `垄断`, `绝对领先`, `完全替代`, `必然爆发` and `确定性极强` must be replaced by the underlying verifiable fact plus attribution, scope and stage. Keep an exact market-share figure only as a company claim and only for the stated segment.
- Before finalizing, scan the topical body for praise and intensifiers including `优秀`, `卓越`, `领先`, `强大`, `成熟`, `先进`, `创新性`, `独特`, `显著`, `快速`, `成功`, `深厚`, `丰富`, `广泛`, `充分`, `高度`, `极具`, `非常`, `较强`, `较高`, `较大`, `良好`, `优异`, `头部`, `龙头` and `核心竞争力`. Retain a word only if it is part of an exact attributed claim or a necessary technical term and its basis and scope are stated; otherwise replace it with evidence or delete it.

House style for the topical body:

- Use coherent paragraphs rather than catalogues or slide-style lists.
- Do not use `【】`, Markdown bullets, numbered sublists or bold inline labels.
- Introduce application areas naturally in sentences, such as “LED方面”“AR方面”“硅光方面”.
- Keep the body selective and readable; preserve the exhaustive sequential detail in `访谈记录`.
- Do not copy every BP product model into the body when the meeting discusses product families instead.

Do not include process commentary such as:

- “录音中提到……”
- “会前简介称……”
- “根据Q&A……”
- “管理层口径与BP冲突……”

Resolve the wording directly. If a material fact remains uncertain, state that the specific amount, customer stage or timing仍需进一步确认 without explaining the drafting process.

## 5. Exact Word structure

Use the user-provided `会议纪要模板.docx` and retain its styles.

### Opening block

1. `<公司名>会议纪要` — Normal paragraph, centered, 16 pt, bold.
2. One empty Normal paragraph.
3. `记录时间：YYYY/M/D` — Normal.
4. `参会人：...` — Normal, left aligned.

### Allowed headings and order

Heading 1 and Heading 2 must appear in this exact order:

1. Heading 1 `公司定位`
2. Heading 1 `市场和产品`
   - Heading 2 `产品`
   - Heading 2 `市场情况`
   - Heading 2 `核心客户`
3. Heading 1 `技术壁垒与创新`
   - Heading 2 `核心技术体系`
   - Heading 2 `技术差异化优势`
4. Heading 1 `财务情况`
5. Heading 1 `融资历史和本轮融资`
   - Heading 2 `历史融资`
   - Heading 2 `本轮融资安排`
6. Heading 1 `发展计划`
7. Heading 1 `访谈记录`

Do not add independent headings such as `团队及组织`, `风险提示`, `主要风险及待核实事项`, `投资亮点` or `结论`. Integrate relevant content naturally into the allowed sections.

### Appended Q&A

- Insert one empty Normal paragraph after `访谈记录`.
- Q paragraph: Normal style, all text bold, no first-line indentation.
- A paragraph: Normal style, regular weight, no first-line indentation.
- Insert one empty Normal paragraph after every A.
- Use the final `Q&A.docx` exactly as approved. Do not add, delete, merge or restore questions during memo generation.

## 6. Validation checklist

Before delivery, confirm:

- App mode has exactly one final memo; standalone intermediate files exist only when explicitly requested;
- no temporary script or extracted text remains;
- speaker/timestamp count in `修正.docx` matches the original;
- standalone Q&A has equal Q and A counts;
- Q&A contains no final generic verification question;
- Q&A paragraphs have zero first-line indent and blank spacing between pairs;
- memo Heading 1/2 order matches the exact sequence above;
- memo title is centered, 16 pt and bold;
- memo questions are bold and answers are not;
- no process-language phrases appear;
- all company forecasts are clearly written as forecasts;
- no DOCX rendering was performed unless explicitly requested.
- source-to-output coverage ledger has no unexplained omissions;
- named customers, products, technical parameters, financial figures, financing terms, dates, forecasts and qualifiers present in the source have been checked against the output;
- transcript paragraph/speaker structure was preserved before Q&A reconstruction;
- every long-text chunk was processed and chunk-boundary content was reconciled.
- Q&A was generated sequentially by transcript chunk for long interviews, and the concatenated result was checked for missing topic transitions.
- each chunk was checked for answer-level information density, not only Q&A count; materially compressed chunks were completed against the original source before assembly.
- topical body and Q&A contain no `【】` labels or model-invented Markdown/outline formatting.
- relevant PDF pages, standalone images and Word/PowerPoint embedded images were checked for visual-only facts;
- equity percentages, entity names, hierarchy, product labels and table figures extracted by OCR were reconciled with the surrounding text;
- uncertain chart relationships remain qualified rather than being converted into unsupported facts.
