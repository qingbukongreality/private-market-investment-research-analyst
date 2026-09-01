import { createServer } from "node:http";
import { access, readdir, readFile, stat, writeFile, mkdir, mkdtemp, cp, rm, rename } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const runFile = promisify(execFile);
const appDir = path.dirname(fileURLToPath(import.meta.url));
const embeddedDir = path.join(appDir, "embedded-skills");
const visionOcr = path.join(appDir, "tools/vision-ocr");
const meetingInstructions = [
  await readFile(path.join(embeddedDir, "investment-meeting-minutes/SKILL.md"), "utf8"),
  await readFile(path.join(embeddedDir, "investment-meeting-minutes/references/workflow-rules.md"), "utf8"),
  "姓名、职务、公司名、产品名和专业术语必须优先采用BP、公司介绍和团队页中的书面写法，纠正录音近音字和转写错误；会议事实、数字、问答和限定仍以录音为准。书面材料之间存在姓名或角色冲突时不得拼接或猜测，应写姓名待确认。",
].join("\n\n");
const intakeInstructions = [
  await readFile(path.join(embeddedDir, "investment-project-intake/SKILL.md"), "utf8"),
  await readFile(path.join(embeddedDir, "investment-project-intake/references/field-schema.md"), "utf8"),
  await readFile(path.join(embeddedDir, "investment-project-intake/references/verification-and-style.md"), "utf8"),
].join("\n\n");

const host = "127.0.0.1";
const port = Number(process.env.DEALFLOW_PORT || 8787);
const dataDir = process.env.DEALFLOW_DATA_DIR || path.join(process.cwd(), "data");
const settingsFile = path.join(dataDir, "settings.json");
const secretsFile = path.join(dataDir, "secrets.json");
let aiConfig = { provider: "deepseek", model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash", apiKeys: { deepseek: process.env.DEEPSEEK_API_KEY || "", minimax: process.env.MINIMAX_API_KEY || "" } };
try {
  const saved = JSON.parse(await readFile(secretsFile, "utf8"));
  const migratedKeys = saved.apiKeys || { deepseek: saved.apiKey || "", minimax: "" };
  const provider = saved.provider === "minimax" ? "minimax" : "deepseek";
  aiConfig = { provider, model: saved.model || (provider === "minimax" ? "MiniMax-M2.7" : "deepseek-v4-flash"), apiKeys: { ...aiConfig.apiKeys, ...migratedKeys } };
} catch {}

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};

function send(res, status, body) {
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

async function bodyJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function providerInfo(provider) {
  return provider === "minimax"
    ? { name: "MiniMax", url: "https://api.minimaxi.com/v1/chat/completions", models: new Set(["MiniMax-M2.7", "MiniMax-M2.7-highspeed"]) }
    : { name: "DeepSeek", url: "https://api.deepseek.com/chat/completions", models: new Set(["deepseek-v4-pro", "deepseek-v4-flash"]) };
}

async function testAI(provider, apiKey, model) {
  const target = providerInfo(provider);
  const response = await fetch(target.url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: "只回答 OK。" }, { role: "user", content: "连接测试" }], ...(provider === "minimax" ? { max_completion_tokens: 64, reasoning_split: false } : { max_tokens: 16 }), stream: false }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `${target.name} 返回 ${response.status}`);
  return true;
}

async function inspectWorkspace(rawPath) {
  const workspacePath = path.resolve(String(rawPath || "").trim());
  if (!path.isAbsolute(String(rawPath || "").trim())) throw new Error("请输入完整的绝对路径");
  const info = await stat(workspacePath);
  if (!info.isDirectory()) throw new Error("该路径不是文件夹");
  await access(workspacePath, constants.R_OK | constants.W_OK);

  const entries = await readdir(workspacePath, { withFileTypes: true });
  const projects = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "dealflow-app" && !entry.name.startsWith("investment-"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
  const excelFiles = entries
    .filter((entry) => entry.isFile() && /\.(xlsx|xls)$/i.test(entry.name))
    .map((entry) => entry.name);

  const meetingTemplates = entries
    .filter((entry) => entry.isFile() && /会议纪要.*模板|模板.*会议纪要/.test(entry.name) && /\.docx$/i.test(entry.name))
    .map((entry) => entry.name);

  return { path: workspacePath, writable: true, projects, excelFiles, meetingTemplates };
}

function safeProjectName(name) {
  const value = String(name || "").trim();
  if (!value || value.includes("/") || value.includes("\\") || value === "." || value === "..") throw new Error("项目名称无效");
  return value;
}

function fileCategory(name) {
  const lower = name.toLowerCase();
  if (/\.(m4a|mp3|wav|aac|mp4)$/.test(lower)) return "录音";
  if (/(修正|校正)/.test(name) && /\.docx?$/.test(lower)) return "修正稿";
  if (/(原文|逐字稿|转写稿)/.test(name) && /\.docx?$/.test(lower)) return "录音原文";
  if (/(q&a|(^|[^a-z])q([^a-z]|$))/i.test(name) && /\.docx?$/.test(lower)) return "Q&A";
  if (/会议纪要/.test(name) && /\.docx?$/.test(lower)) return "会议纪要";
  if (/(bp|商业计划书|路演)/i.test(name) || /\.pdf$/.test(lower)) return "BP/材料";
  if (/\.(docx?|pptx?|xlsx?|png|jpe?g)$/.test(lower)) return "补充材料";
  return "其他";
}

function xmlDecode(text) {
  return text
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function xmlEscape(text) { return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function htmlEscape(text) { return xmlEscape(text).replace(/\n/g, "<br>"); }

async function archiveText(filePath, patterns) {
  const { stdout: list } = await runFile("/usr/bin/unzip", ["-Z1", filePath], { maxBuffer: 1024 * 1024 * 8 });
  const names = list.split("\n").filter(name => patterns.some(pattern => pattern.test(name))).slice(0, 300);
  const parts = [];
  for (const name of names) {
    try { const { stdout } = await runFile("/usr/bin/unzip", ["-p", filePath, name], { maxBuffer: 1024 * 1024 * 20 }); parts.push(xmlDecode(stdout)); } catch {}
  }
  return parts.join("\n");
}

async function archiveEntry(filePath, name) {
  try {
    const { stdout } = await runFile("/usr/bin/unzip", ["-p", filePath, name], { maxBuffer: 1024 * 1024 * 30 });
    return String(stdout || "");
  } catch { return ""; }
}

function xlsxCellText(cellXml, type, sharedStrings) {
  if (type === "s") {
    const index = Number(/<v>([\s\S]*?)<\/v>/.exec(cellXml)?.[1]);
    return Number.isInteger(index) ? String(sharedStrings[index] || "") : "";
  }
  if (type === "inlineStr" || type === "str") return xmlDecode(cellXml);
  return xmlDecode(/<v>([\s\S]*?)<\/v>/.exec(cellXml)?.[1] || "");
}

async function firstProjectIntakeStyleExample(filePath) {
  if (!filePath || !/\.xlsx$/i.test(filePath) || !(await fileExists(filePath))) return "";
  const sharedXml = await archiveEntry(filePath, "xl/sharedStrings.xml");
  const sharedStrings = [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match => xmlDecode(match[1]));
  const sheetXml = await archiveEntry(filePath, "xl/worksheets/sheet1.xml");
  for (const row of sheetXml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const cell of row[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const col = /\br="([A-Z]+)\d+"/.exec(cell[1])?.[1];
      if (!col) continue;
      const type = /\bt="([^"]+)"/.exec(cell[1])?.[1] || "";
      cells[col] = xlsxCellText(cell[2], type, sharedStrings).trim();
    }
    if (!cells.B || !(cells.K || cells.L) || !/(?:1[.．、]\s*团队|团队)/.test(cells.L || "")) continue;
    const labels = { B: "项目简称", E: "上市申报预期", F: "前一轮融资", G: "已投机构", H: "本轮投前估值", I: "本次融资额", J: "融资截止时间", K: "主营业务", L: "价值", M: "收入", N: "利润" };
    return Object.entries(labels).filter(([col]) => cells[col]).map(([col, label]) => `${label}：${cells[col]}`).join("\n").slice(0, 9000);
  }
  return "";
}

async function walkFiles(folder) {
  const found = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const item = path.join(folder, entry.name);
    if (entry.isDirectory()) found.push(...await walkFiles(item));
    else found.push(item);
  }
  return found;
}

async function ocrFile(filePath) {
  try {
    const { stdout } = await runFile(visionOcr, [filePath], { maxBuffer: 1024 * 1024 * 40 });
    return String(stdout || "").trim();
  } catch { return ""; }
}

function imagePrompt(label) {
  if (/(股权|穿透|股东|实控人|组织架构)/i.test(label)) return "这是一级市场项目材料中的股权或组织关系图。只报告图中直接可见的事实：完整识别所有主体名称、直接持股比例、上下层级、箭头或连接方向、间接持股路径、实际控制人、查询日期及图例。严格区分直接持股与间接持股；关系不清楚时仅写‘图中关系需确认’，不得猜测。禁止自行推测隐藏股东、配偶或一致行动关系、VIE、并表情况、流通股及其他图中未显示事项，也不要输出通用尽调建议。使用结构化中文逐条输出，并保留全部百分比和实体全称。";
  if (/(产品|设备|技术|工艺|流程|架构|路线|参数)/i.test(label)) return "这是一级市场项目材料中的产品、技术、工艺或架构图片。请识别全部可见文字、产品型号、技术参数、单位、流程顺序、模块连接、图例、比较关系和应用场景。说明图表达的核心关系，不得夸大，不得补充图中没有的信息。";
  if (/(财务|收入|利润|订单|市场|客户|表格|图表)/i.test(label)) return "这是一级市场项目材料中的表格或数据图。请逐项提取标题、行列、年份、数字、单位、比例、口径、趋势、客户或市场分类。区分历史数据、预测和目标；不要遗漏脚注，不得推算图中未提供的数据。";
  return "请完整理解这张一级市场项目材料图片：识别所有可见文字、表格、数字、单位、主体、箭头、层级、流程、产品和技术标签，并说明图片表达的关系及对公司业务的事实性含义。区分已完成、测试中、计划和预测；不得使用夸大词，不得猜测看不清的关系。";
}

async function miniMaxUnderstandImage(filePath, label = path.basename(filePath)) {
  const fallback = () => ocrFile(filePath);
  const apiKey = aiConfig.apiKeys.minimax;
  if (!apiKey) return fallback();
  let tileTemp = "";
  try {
    const { stdout: imageInfo } = await runFile("/usr/bin/sips", ["-g", "pixelWidth", "-g", "pixelHeight", filePath], { maxBuffer: 1024 * 1024 });
    const width = Number(/pixelWidth:\s*(\d+)/.exec(imageInfo)?.[1] || 0);
    const height = Number(/pixelHeight:\s*(\d+)/.exec(imageInfo)?.[1] || 0);
    if (width > 4000 && height > 0) {
      tileTemp = await mkdtemp(path.join(os.tmpdir(), "dealflow-panorama-"));
      await runFile(visionOcr, ["--tile-image", filePath, tileTemp], { maxBuffer: 1024 * 1024 });
      const tiles = (await readdir(tileTemp)).filter(name => /^tile-\d+\.jpg$/i.test(name)).sort().map(name => path.join(tileTemp, name));
      const parts = await mapWithLimit(tiles, 2, async (tile, index) => {
        const text = await miniMaxUnderstandImage(tile, `${label} 横向分块${index + 1}/${tiles.length}`);
        return text ? `[横向分块${index + 1}/${tiles.length}]\n${text}` : "";
      });
      return parts.filter(Boolean).join("\n\n");
    }
  } catch {}
  finally { if (tileTemp) await rm(tileTemp, { recursive: true, force: true }); }
  let prepared = filePath; let temp = "";
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext) || (await stat(filePath)).size > 18 * 1024 * 1024) {
      temp = await mkdtemp(path.join(os.tmpdir(), "dealflow-image-"));
      prepared = path.join(temp, "image.jpg");
      await runFile("/usr/bin/sips", ["-s", "format", "jpeg", "--resampleWidth", "2400", filePath, "--out", prepared]);
    }
    const buffer = await readFile(prepared);
    const mime = path.extname(prepared).toLowerCase() === ".png" ? "image/png" : path.extname(prepared).toLowerCase() === ".webp" ? "image/webp" : "image/jpeg";
    const response = await fetch("https://api.minimaxi.com/v1/coding_plan/vlm", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "MM-API-Source": "FengYuan-Workbench" },
      body: JSON.stringify({ prompt: imagePrompt(label), image_url: `data:${mime};base64,${buffer.toString("base64")}` })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.base_resp?.status_code) throw new Error(data?.base_resp?.status_msg || data?.error?.message || `图片理解返回 ${response.status}`);
    const content = String(data?.content || "").trim();
    const localOcr = await ocrFile(filePath);
    return [content ? `[图片关系理解]\n${content}` : "", localOcr ? `[本地OCR原文]\n${localOcr}` : ""].filter(Boolean).join("\n\n");
  } catch { return fallback(); }
  finally { if (temp) await rm(temp, { recursive: true, force: true }); }
}

async function mapWithLimit(items, limit, worker) {
  const results = new Array(items.length); let cursor = 0;
  async function run() { while (cursor < items.length) { const index = cursor++; results[index] = await worker(items[index], index); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function pdfVisualText(filePath) {
  if (!aiConfig.apiKeys.minimax) return ocrFile(filePath);
  const temp = await mkdtemp(path.join(os.tmpdir(), "dealflow-pdf-pages-"));
  try {
    await runFile(visionOcr, ["--render-pdf", filePath, temp], { maxBuffer: 1024 * 1024 });
    const pages = (await readdir(temp)).filter(name => /^page-\d+\.jpg$/i.test(name)).sort().slice(0, 80);
    const analyses = await mapWithLimit(pages, 3, async (name, index) => {
      const content = await miniMaxUnderstandImage(path.join(temp, name), `${path.basename(filePath)} 第${index + 1}页`);
      return content ? `[第${index + 1}页 MiniMax图片理解]\n${content}` : "";
    });
    return analyses.filter(Boolean).join("\n\n");
  } finally { await rm(temp, { recursive: true, force: true }); }
}

async function embeddedImageText(filePath, mediaPattern) {
  const temp = await mkdtemp(path.join(os.tmpdir(), "dealflow-media-"));
  try {
    try { await runFile("/usr/bin/unzip", ["-q", filePath, mediaPattern, "-d", temp]); } catch { return ""; }
    const images = (await walkFiles(temp)).filter(name => /\.(png|jpe?g|webp|tiff?|bmp|heic)$/i.test(name)).slice(0, 160);
    const parts = await mapWithLimit(images, 3, async image => {
      const text = await miniMaxUnderstandImage(image, `${path.basename(filePath)} 内嵌图片 ${path.basename(image)}`);
      return text ? `[内嵌图片：${path.basename(image)} MiniMax图片理解]\n${text}` : "";
    });
    return parts.join("\n\n");
  } finally { await rm(temp, { recursive: true, force: true }); }
}

async function extractFileText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".docx") return [await archiveText(filePath, [/^word\/document\.xml$/]), await embeddedImageText(filePath, "word/media/*")].filter(Boolean).join("\n\n");
  if (ext === ".pptx") return [await archiveText(filePath, [/^ppt\/slides\/slide\d+\.xml$/]), await embeddedImageText(filePath, "ppt/media/*")].filter(Boolean).join("\n\n");
  if ([".doc", ".ppt"].includes(ext)) return "";
  if ([".xlsx", ".xls"].includes(ext)) return archiveText(filePath, [/^xl\/sharedStrings\.xml$/, /^xl\/worksheets\/sheet\d+\.xml$/]);
  if ([".txt", ".md", ".csv", ".json"].includes(ext)) return readFile(filePath, "utf8");
  if (ext === ".pdf") {
    let text = "";
    try { const { stdout } = await runFile("/usr/bin/mdls", ["-raw", "-name", "kMDItemTextContent", filePath], { maxBuffer: 1024 * 1024 * 20 }); text = stdout === "(null)\n" ? "" : stdout; } catch {}
    if (text.length < 1500 || /(BP|商业计划|路演|简介|介绍|股权|组织|架构|扫描)/i.test(path.basename(filePath))) return [text, await pdfVisualText(filePath)].filter(Boolean).join("\n\n");
    return text;
  }
  if ([".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp", ".heic"].includes(ext)) return miniMaxUnderstandImage(filePath);
  return "";
}

async function collectMaterials(details) {
  const chunks = [];
  for (const file of details.files) {
    if (/\.(m4a|mp3|wav|aac|mp4)$/i.test(file.name)) continue;
    const text = await extractFileText(path.join(details.path, file.name));
    if (text.trim()) chunks.push(`\n===== ${file.name}（${file.category}）=====\n${text.slice(0, 180000)}`);
  }
  if (!chunks.length) throw new Error("没有找到可读取的文字材料。请至少提供录音原文、BP、简介或其他文字文件。");
  return chunks.join("\n").slice(0, 520000);
}

async function collectTranscript(details) {
  const preferred = details.files.filter(file => ["修正稿", "录音原文"].includes(file.category));
  const chunks = [];
  for (const file of preferred) {
    const text = await extractFileText(path.join(details.path, file.name));
    if (text.trim()) chunks.push(`===== ${file.name}（${file.category}）=====\n${text.slice(0, 300000)}`);
  }
  return chunks.join("\n\n").slice(0, 520000);
}

function meetingEntityReferenceMaterials(materials) {
  return String(materials || "")
    .split(/(?=\n===== )/)
    .filter(section => !/（(?:修正稿|录音原文|Q&A|会议纪要)）=====/.test(section))
    .join("\n")
    .slice(0, 120000);
}

function splitTranscript(text, targetSize = 3000) {
  const paragraphs = String(text || "").split(/\n+/).map(item => item.trim()).filter(Boolean);
  const chunks = []; let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > targetSize) { chunks.push(current); current = ""; }
    if (paragraph.length > targetSize) {
      if (current) { chunks.push(current); current = ""; }
      for (let offset = 0; offset < paragraph.length; offset += targetSize) chunks.push(paragraph.slice(offset, offset + targetSize));
    } else current += `${current ? "\n\n" : ""}${paragraph}`;
  }
  if (current) chunks.push(current);
  return chunks;
}

function cleanMemoBody(value) {
  return calibrateClaims(String(value || "")
    .replace(/【([^】]+)】/g, "$1方面，")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/^\s*\d+[.、]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim());
}

function writtenChinese(value) {
  let text = String(value || "")
    .replace(/(^|[。！？；]\s*)(?:嗯+|啊+|呃+|好的?|对(?:的)?|这个|那个)[，,、。；：:\s]+/g, "$1")
    .replace(/我(?:先|来)?简单(?:地)?(?:说|介绍|讲)一下[，,、]?/g, "")
    .replace(/这个(?:怎么说|怎么讲)[，,、]?/g, "")
    .replace(/[，,、]?(?:你知道吧|对吧)[，,、。]?/g, "。")
    .replace(/请问一下/g, "请问")
    .replace(/能不能简单介绍一下/g, "请介绍")
    .replace(/\s{2,}/g, " ")
    .replace(/。{2,}/g, "。");
  return text.trim();
}

function calibrateClaims(value) {
  let text = String(value || "")
    .replace(/绝对龙头|行业龙头/g, "主要参与者之一")
    .replace(/完全垄断|基本垄断|垄断多年|垄断地位|处于垄断状态|形成垄断|垄断/g, "市场份额较高")
    .replace(/(?:国内|行业|全球)唯一(?:一家)?/g, "据公司介绍，少数已实现相关能力的企业之一")
    .replace(/遥遥领先|绝对领先/g, "具有一定先发优势")
    .replace(/完全替代/g, "在部分场景实现替代")
    .replace(/必然爆发|确定爆发|全面爆发/g, "可能较快增长")
    .replace(/确定性极强/g, "具备一定发展潜力");
  text = text.split(/(?<=[。！？\n])/).map(sentence => /(?:接近|约|达到)\s*100%/.test(sentence) && !/(?:公司(?:表示|称|介绍|认为)|据公司)/.test(sentence) ? `据公司介绍，${sentence}` : sentence).join("");
  return text;
}

function cleanQAItems(items) {
  const processText = /(?:当前|本|上述|以上|前一|下一|后续|其余|剩余)(?:连续)?(?:访谈)?片段|(?:以上|上述|后续|其余|剩余)(?:访谈)?内容|(?:下一段|下一个片段)(?:生成|处理|继续)|继续(?:生成|处理)(?:下一段|后续内容)|本次仅处理|待后续(?:片段)?(?:生成|处理)|截至当前片段|以上为本段/;
  return Array.isArray(items) ? items.filter(item => item?.q && item?.a && !processText.test(`${item.q}\n${item.a}`)).map(item => ({
    q: writtenChinese(calibrateClaims(String(item.q).replace(/[【】]/g, "").replace(/^\s*[-•]\s+/, ""))),
    a: writtenChinese(calibrateClaims(String(item.a).replace(/[【】]/g, "").replace(/^\s*[-•]\s+/gm, "").replace(/^\s*\d+[.、]\s+/gm, "")))
  })).filter(item => item.q && item.a && !processText.test(`${item.q}\n${item.a}`)) : [];
}

function qaInformationLength(items) {
  return items.reduce((total, item) => total + item.q.length + item.a.length, 0);
}

function multilineFinancing(value) {
  return String(value || "")
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/\s*[；;]\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function multilineFinancialResult(value) {
  return blankMissing(value)
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/\s*[；;]\s*/g, "\n")
    .replace(/[，,]\s*(?=20\d{2}年)/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function detailedInvestors(value) {
  return multilineFinancing(value).split(/\n+/).map(line => {
    const text = line.trim();
    if (!text || /未披露具体数额/.test(text)) return text;
    const hasAmount = /(?:人民币|美元|港元|融资额|投资额|出资额|数额|金额)|\d+(?:\.\d+)?\s*(?:亿|万)(?:元|美元|人民币|港元)?/.test(text);
    return hasAmount ? text : `${text}，未披露具体数额`;
  }).filter(Boolean).join("\n");
}

function hasExplicitIpoPlan(materials) {
  const text = String(materials || "");
  return /(?:上市计划|IPO计划|计划上市|拟上市|筹备上市|上市申报|申报上市|启动IPO|推进IPO|IPO申报|辅导备案|上市辅导|(?:科创板|创业板|北交所|港股|美股)(?:上市|申报))/.test(text);
}

function blankMissing(value) {
  const text = String(value || "").trim();
  return /^(?:暂无(?:可靠)?(?:信息|披露|数据)?|未(?:披露|提及|说明|提供)|没有(?:披露|提及|说明)|材料中?未(?:披露|提及|说明)|待(?:补充|确认)|不详|无)$/.test(text) ? "" : text;
}

function removeMissingPlaceholders(value) {
  return String(value || "").replace(/\\r\\n|\\n|\\r/g, "\n").split("\n").map(line => {
    const match = /^((?:[1-7])\.(?:团队|股权结构|产品|技术|生产、客户|市场|收入))\s*(.*)$/.exec(line.trim());
    if (!match) return blankMissing(line);
    return blankMissing(match[2]) ? `${match[1]}${match[2].trim()}` : match[1];
  }).filter(Boolean).join("\n");
}

function conflictNotes(value) {
  return String(value || "").replace(/\\r\\n|\\n|\\r/g, "\n").split(/\n+/)
    .map(line => line.trim())
    .filter(line => line && !/^(?:暂无|未披露|未提及|无冲突|无)$/.test(line))
    .map(line => /^冲突[:：]/.test(line) ? line.replace(/^冲突:/, "冲突：") : `冲突：${line}`)
    .join("\n");
}

function parseAIJson(raw) {
  const cleaned = String(raw || "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try { return JSON.parse(candidate); } catch {}
  let repaired = "", inString = false, escaped = false;
  for (const char of candidate) {
    if (escaped) { repaired += char; escaped = false; continue; }
    if (char === "\\" && inString) { repaired += char; escaped = true; continue; }
    if (char === '"') { repaired += char; inString = !inString; continue; }
    if (inString && char === "\n") { repaired += "\\n"; continue; }
    if (inString && char === "\r") continue;
    if (inString && char === "\t") { repaired += "\\t"; continue; }
    repaired += char;
  }
  repaired = repaired.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(repaired);
}

async function aiJson(system, prompt, maxTokens = 12000, signal) {
  const target = providerInfo(aiConfig.provider);
  const apiKey = aiConfig.apiKeys[aiConfig.provider];
  const safePrompt = aiConfig.provider === "minimax" ? prompt.slice(0, 165000) : prompt;
  const structuredTool = {
    type: "function",
    function: {
      name: "submit_result",
      description: "提交最终结构化结果。必须保留材料中的完整事实与数字。",
      parameters: {
        type: "object",
        properties: {
          companyPosition: { type: "string" }, product: { type: "string" }, marketSituation: { type: "string" }, coreCustomers: { type: "string" }, coreTechnology: { type: "string" }, differentiation: { type: "string" }, financials: { type: "string" }, historicalFinancing: { type: "string" }, currentRound: { type: "string" }, developmentPlan: { type: "string" },
          qa: { type: "array", items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q", "a"] } },
          shortName: { type: "string" }, establishedDate: { type: "string" }, city: { type: "string" }, ipoPlan: { type: "string" }, previousRound: { type: "string" }, investors: { type: "string" }, currentPreMoney: { type: "string" }, currentFinancing: { type: "string" }, financingDeadline: { type: "string" }, mainBusiness: { type: "string" }, value: { type: "string" }, revenue: { type: "string" }, profit: { type: "string" }, notes: { type: "string" }
        },
        additionalProperties: false
      }
    }
  };
  const requestBody = { model: aiConfig.model, messages: [{ role: "system", content: `${system}\n${aiConfig.provider === "minimax" ? "必须立即调用 submit_result 工具提交最终结果，不要在普通回复中输出结果。" : "只返回一个合法JSON对象，不要使用Markdown代码块。JSON字符串中的换行必须写成\\n，禁止直接换行。"}` }, { role: "user", content: safePrompt }], temperature: aiConfig.provider === "minimax" ? 0.2 : undefined, ...(aiConfig.provider === "minimax" ? { max_completion_tokens: maxTokens, reasoning_split: false, tools: [structuredTool], tool_choice: { type: "function", function: { name: "submit_result" } } } : { max_tokens: maxTokens, response_format: { type: "json_object" } }), stream: false };
  const response = await fetch(target.url, { method: "POST", headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(requestBody), signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `${target.name} 返回 ${response.status}`);
  const toolArguments = data?.choices?.[0]?.message?.tool_calls?.find(call => call?.function?.name === "submit_result")?.function?.arguments;
  if (toolArguments) try { return parseAIJson(toolArguments); } catch {}
  const content = String(data?.choices?.[0]?.message?.content || "").trim();
  const repairCandidate = String(toolArguments || content).trim();
  if (data?.choices?.[0]?.finish_reason === "length") throw new Error(`${target.name} 输出达到长度上限，请重试；如仍失败请切换高速模型或减少单次材料量`);
  if (!repairCandidate) throw new Error(`${target.name} 未返回正文，请重试`);
  try { return parseAIJson(content); } catch {}
  if (aiConfig.provider !== "minimax") throw new Error(`${target.name} 返回内容无法解析，请重试`);
  const repairResponse = await fetch(target.url, { method: "POST", headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: aiConfig.model, messages: [{ role: "system", content: "你是JSON修复器。保持全部原始信息，只修复JSON语法。只输出一个合法JSON对象，字符串内换行写成\\n。" }, { role: "user", content: repairCandidate }], temperature: 0.1, max_completion_tokens: maxTokens, reasoning_split: false, stream: false }), signal });
  const repairData = await repairResponse.json().catch(() => ({}));
  if (!repairResponse.ok) throw new Error(repairData?.error?.message || `${target.name} JSON修复失败`);
  try { return parseAIJson(repairData?.choices?.[0]?.message?.content); } catch { throw new Error(`${target.name} 返回内容无法解析，请重试`); }
}

function wordParagraph(text = "", style = "1", options = {}) {
  const pPr = [`<w:pStyle w:val="${style}"/>`, options.center ? '<w:jc w:val="center"/>' : "", options.noIndent ? '<w:ind w:left="0" w:right="0" w:firstLine="0" w:firstLineChars="0" w:hanging="0"/>' : ""].join("");
  if (!text) return `<w:p><w:pPr>${pPr}</w:pPr></w:p>`;
  const rPr = `${options.bold ? "<w:b/>" : ""}${options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : ""}`;
  return `<w:p><w:pPr>${pPr}</w:pPr><w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

async function makeTemplateDocx(template, outputFile, paragraphs) {
  const temp = await mkdtemp(path.join(os.tmpdir(), "dealflow-docx-"));
  try {
    await runFile("/usr/bin/unzip", ["-q", template, "-d", temp]);
    const documentFile = path.join(temp, "word/document.xml");
    const original = await readFile(documentFile, "utf8");
    const prefix = original.slice(0, original.indexOf("<w:body>") + 8);
    const section = original.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0] || "<w:sectPr/>";
    await writeFile(documentFile, `${prefix}${paragraphs.join("")}${section}</w:body></w:document>`);
    await rm(outputFile, { force: true });
    await runFile("/usr/bin/zip", ["-qr", outputFile, "."], { cwd: temp });
  } finally { await rm(temp, { recursive: true, force: true }); }
}

function bodyParagraphs(text) {
  return String(text || "暂无可靠披露").split(/\n+/).filter(Boolean).map(line => wordParagraph(line));
}

async function makeMemoDocx(template, outputFile, company, meetingDate, participants, result, qa) {
  const p = [wordParagraph(`${company}会议纪要`, "1", { center: true, bold: true, size: 32 }), wordParagraph(), wordParagraph(`记录时间：${meetingDate.replaceAll("-", "/")}`), wordParagraph(`参会人：${participants || "待补充"}`)];
  const section = (title, key) => p.push(wordParagraph(title, "2"), ...bodyParagraphs(result[key]));
  section("公司定位", "companyPosition");
  p.push(wordParagraph("市场和产品", "2"), wordParagraph("产品", "3"), ...bodyParagraphs(result.product), wordParagraph("市场情况", "3"), ...bodyParagraphs(result.marketSituation), wordParagraph("核心客户", "3"), ...bodyParagraphs(result.coreCustomers));
  p.push(wordParagraph("技术壁垒与创新", "2"), wordParagraph("核心技术体系", "3"), ...bodyParagraphs(result.coreTechnology), wordParagraph("技术差异化优势", "3"), ...bodyParagraphs(result.differentiation));
  section("财务情况", "financials");
  p.push(wordParagraph("融资历史和本轮融资", "2"), wordParagraph("历史融资", "3"), ...bodyParagraphs(result.historicalFinancing), wordParagraph("本轮融资安排", "3"), ...bodyParagraphs(result.currentRound));
  section("发展计划", "developmentPlan");
  p.push(wordParagraph("访谈记录", "2"));
  for (const item of qa) p.push(wordParagraph(`Q：${item.q || ""}`, "1", { bold: true, noIndent: true }), wordParagraph(`A：${item.a || ""}`, "1", { noIndent: true }), wordParagraph("", "1", { noIndent: true }));
  await makeTemplateDocx(template, outputFile, p);
}

async function appendExcel(template, outputFile, values) {
  const temp = await mkdtemp(path.join(os.tmpdir(), "dealflow-xlsx-"));
  try {
    await runFile("/usr/bin/unzip", ["-q", template, "-d", temp]);
    const sheetFile = path.join(temp, "xl/worksheets/sheet1.xml"); let xml = await readFile(sheetFile, "utf8");
    const rows = [...xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>[\s\S]*?<\/row>/g)]; const last = rows.at(-1); const rowNo = Number(last?.[1] || 1) + 1; const lastXml = last?.[0] || "";
    const sharedXml = await readFile(path.join(temp, "xl/sharedStrings.xml"), "utf8").catch(() => "");
    const sharedValues = [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match => xmlDecode(match[1]).trim());
    const sequences = rows.map(row => {
      const rowXml = row[0]; const rowIndex = row[1];
      const cell = new RegExp(`<c\\b([^>]*)r="A${rowIndex}"([^>]*)>([\\s\\S]*?)<\\/c>`).exec(rowXml);
      if (!cell) return NaN;
      const attrs = `${cell[1]} ${cell[2]}`; const body = cell[3];
      const raw = /\bt="s"/.test(attrs) ? sharedValues[Number(/<v>(\d+)<\/v>/.exec(body)?.[1])] : (/<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] || /<v>([^<]+)<\/v>/.exec(body)?.[1] || "");
      return /^\d+$/.test(String(raw).trim()) ? Number(raw) : NaN;
    }).filter(Number.isFinite);
    values[0] = String((sequences.length ? Math.max(...sequences) : 0) + 1);
    const cols = "ABCDEFGHIJKLMNOPQR".split("");
    const cells = cols.map((col, index) => { const style = new RegExp(`<c\\b[^>]*r="${col}${rowNo-1}"[^>]*s="(\\d+)"`).exec(lastXml)?.[1]; const cellValue = String(values[index] || "").replace(/\\r\\n|\\n|\\r/g, "\n"); return `<c r="${col}${rowNo}"${style ? ` s="${style}"` : ""} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cellValue)}</t></is></c>`; }).join("");
    const previousRowTag = /^<row\b([^>]*)>/.exec(lastXml)?.[1] || "";
    const rowAttrs = previousRowTag.replace(/\br="\d+"/, `r="${rowNo}"`).replace(/\bspans="[^"]*"/, 'spans="1:18"');
    xml = xml.replace(/<\/sheetData>/, `<row${rowAttrs}>${cells}</row></sheetData>`).replace(/<dimension ref="([A-Z]+\d+):([A-Z]+)\d+"\/>/, `<dimension ref="$1:R${rowNo}"/>`);
    await writeFile(sheetFile, xml); await rm(outputFile, { force: true });
    await runFile("/usr/bin/zip", ["-qr", outputFile, "."], { cwd: temp });
  } finally { await rm(temp, { recursive: true, force: true }); }
}

async function fileExists(filePath) { try { await stat(filePath); return true; } catch { return false; } }
async function versionedPath(filePath) {
  const ext = path.extname(filePath), base = filePath.slice(0, -ext.length);
  for (let version = 2; version < 1000; version++) { const candidate = `${base}_v${version}${ext}`; if (!(await fileExists(candidate))) return candidate; }
  throw new Error("无法创建新的文件版本");
}

async function projectDetails(workspace, projectName) {
  const root = (await inspectWorkspace(workspace)).path;
  const name = safeProjectName(projectName);
  const projectPath = path.join(root, name);
  const resolved = path.resolve(projectPath);
  if (path.dirname(resolved) !== root) throw new Error("项目路径越界");
  const entries = await readdir(resolved, { withFileTypes: true });
  const files = await Promise.all(entries.filter(entry => entry.isFile() && !entry.name.startsWith(".")).map(async entry => {
    const info = await stat(path.join(resolved, entry.name));
    return { name: entry.name, category: fileCategory(entry.name), size: info.size, modifiedAt: info.mtime.toISOString() };
  }));
  let metadata = { company: name, meetingDate: "", participants: "", projectSource: "" };
  try { metadata = { ...metadata, ...JSON.parse(await readFile(path.join(resolved, ".dealflow.json"), "utf8")) }; } catch {}
  const categories = new Set(files.map(file => file.category));
  const stages = [
    { id: "materials", label: "材料读取", status: files.length ? "ready" : "empty", ai: false },
    { id: "memo", label: "生成会议纪要", status: categories.has("会议纪要") ? "done" : "waiting", ai: true },
    { id: "facts", label: "项目字段提取", status: "waiting", ai: true },
    { id: "business", label: "工商与市场核验", status: "waiting", ai: true },
    { id: "excel", label: "写入 Excel", status: "waiting", ai: false },
  ];
  return { name, path: resolved, metadata, files: files.sort((a,b) => b.modifiedAt.localeCompare(a.modifiedAt)), stages };
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  try {
    if (req.method === "GET" && req.url === "/api/health") {
      return send(res, 200, { ok: true, service: "投研项目工作台本地服务", aiProvider: providerInfo(aiConfig.provider).name, aiProviderId: aiConfig.provider, aiModel: aiConfig.model, aiConfigured: Boolean(aiConfig.apiKeys[aiConfig.provider]) });
    }
    if (req.method === "GET" && req.url === "/api/settings") {
      try {
        return send(res, 200, JSON.parse(await readFile(settingsFile, "utf8")));
      } catch {
        return send(res, 200, { workspacePath: null });
      }
    }
    if (req.method === "POST" && req.url === "/api/workspace/inspect") {
      const body = await bodyJson(req);
      const result = await inspectWorkspace(body.path);
      if (body.save) {
        await mkdir(dataDir, { recursive: true });
        await writeFile(settingsFile, JSON.stringify({ workspacePath: result.path }, null, 2));
      }
      return send(res, 200, { ok: true, ...result });
    }
    const requestUrl = new URL(req.url || "/", `http://${host}:${port}`);
    if (req.method === "GET" && requestUrl.pathname === "/api/project") {
      return send(res, 200, { ok: true, ...(await projectDetails(requestUrl.searchParams.get("workspace"), requestUrl.searchParams.get("name"))) });
    }
    if (req.method === "POST" && requestUrl.pathname === "/api/project/create") {
      const body = await bodyJson(req); const root = (await inspectWorkspace(body.workspace)).path; const name = safeProjectName(body.name);
      await mkdir(path.join(root, name));
      return send(res, 200, { ok: true, ...(await projectDetails(root, name)) });
    }
    if (req.method === "POST" && requestUrl.pathname === "/api/project/metadata") {
      const body = await bodyJson(req); const details = await projectDetails(body.workspace, body.name);
      const metadata = { company: details.name, meetingDate: String(body.meetingDate || ""), participants: String(body.participants || ""), projectSource: String(body.projectSource || "") };
      await writeFile(path.join(details.path, ".dealflow.json"), JSON.stringify(metadata, null, 2));
      return send(res, 200, { ok: true, metadata });
    }
    if (req.method === "POST" && requestUrl.pathname === "/api/project/upload") {
      const details = await projectDetails(requestUrl.searchParams.get("workspace"), requestUrl.searchParams.get("name"));
      const filename = path.basename(String(requestUrl.searchParams.get("filename") || ""));
      if (!filename || filename.startsWith(".")) throw new Error("文件名无效");
      const chunks = []; let total = 0;
      for await (const chunk of req) { total += chunk.length; if (total > 1024 * 1024 * 500) throw new Error("单个文件不能超过 500MB"); chunks.push(chunk); }
      await writeFile(path.join(details.path, filename), Buffer.concat(chunks));
      return send(res, 200, { ok: true, filename, size: total });
    }
    if (req.method === "POST" && requestUrl.pathname === "/api/stage/run") {
      const body = await bodyJson(req);
      const generationAbort = new AbortController();
      res.once("close", () => { if (!res.writableEnded) generationAbort.abort(); });
      if (!aiConfig.apiKeys[aiConfig.provider]) return send(res, 412, { ok: false, needsAI: true, error: `此步骤需要 ${providerInfo(aiConfig.provider).name}，请先完成本地 AI 配置。` });
      const details = await projectDetails(body.workspace, body.project);
      const date = String(details.metadata.meetingDate || new Date().toISOString().slice(0,10)).replaceAll("-", "");
      const outputRoot = path.resolve(String(body.outputPath || body.workspace || ""));
      let outputFile = "";
      if (body.stage === "会议纪要") {
        await access(outputRoot, constants.R_OK | constants.W_OK);
        const outputDir = path.join(outputRoot, details.name); await mkdir(outputDir, { recursive: true });
        outputFile = path.join(outputDir, `${details.name}会议纪要${date}.docx`);
      }
      if (body.stage === "会议纪要" && await fileExists(outputFile)) {
        if (body.fileMode === "version") outputFile = await versionedPath(outputFile);
        else if (body.fileMode !== "overwrite") return send(res, 409, { ok: false, conflict: true, error: "输出文件已存在", outputFile });
      }
      const materials = await collectMaterials(details);
      if (body.stage === "会议纪要") {
        const workspaceInfo = await inspectWorkspace(body.workspace);
        const templateName = workspaceInfo.meetingTemplates.find(name => name === "会议纪要模板.docx") || workspaceInfo.meetingTemplates[0];
        if (!templateName) throw new Error("未找到会议纪要模板，请在输入根目录放置《会议纪要模板.docx》");
        const template = path.join(body.workspace, templateName);
        const base = `公司：${details.name}\n记录时间：${details.metadata.meetingDate}\n参会人：${details.metadata.participants}\n\n材料：${materials}`;
        const result = await aiJson(`${meetingInstructions}\n\n只生成最终会议纪要的主题正文，不输出中间文件。只输出JSON，必须包含 companyPosition,product,marketSituation,coreCustomers,coreTechnology,differentiation,financials,historicalFinancing,currentRound,developmentPlan。主题正文采用投资会议纪要的连贯中文段落，不是BP摘抄或PPT提纲。每个字段通常写1至4段，信息密度高但避免罗列全部产品型号。严禁使用【】标签、Markdown短横线、编号清单或段内小标题；应用领域应自然写成“LED方面，……”“AR方面，……”。严禁把BP或管理层的宣传话术写成客观结论，不使用“唯一、垄断、绝对领先、绝对龙头、完全替代、必然爆发、确定性极强”等绝对表述；改写为带有“公司表示/据公司介绍”的具体事实，并注明应用范围、客户阶段和时间范围。保留关键产品类型与用途、技术参数与比较、客户名称与合作阶段、订单、产能、价格、收入利润、时间节点、融资金额估值、团队和发展计划；完整的逐问逐答细节放在访谈记录中。不得编造，不得输出过程说明。`, base, 14000, generationAbort.signal);
        const transcript = await collectTranscript(details);
        const qaSource = transcript || materials;
        const entitySources = meetingEntityReferenceMaterials(materials);
        const entityReference = entitySources ? await aiJson(`${meetingInstructions}\n\n只建立会议文字校正所需的实体对照表，只输出JSON，字段为 people,organizations,products,terms。people数组每项包含name,title,aliases；organizations、products、terms为字符串数组。优先从BP、公司简介和团队材料提取姓名、博士/总经理/董事长/创始人等职务称谓，以及公司、客户、产品、技术和英文缩写的规范写法。aliases只写材料中明确出现的简称或称谓，不得臆造录音误识别形式。不要输出履历摘要或其他说明。`, `公司：${details.name}\n\n会前参考材料：\n${entitySources}`, 3000, generationAbort.signal) : { people: [], organizations: [], products: [], terms: [] };
        const entityReferenceText = JSON.stringify(entityReference);
        const transcriptChunks = splitTranscript(qaSource);
        const qa = [];
        async function processTranscriptChunk(index) {
          const chunk = transcriptChunks[index];
          const qaResult = await aiJson(`${meetingInstructions}\n\n只处理当前访谈片段，生成最终会议纪要“访谈记录”所需的Q&A。只输出JSON字段qa。这是一份忠实的书面化访谈整理稿，不是摘要。必须从头到尾识别并保留原文中的每一个提问、追问、反问式确认和由回答者主动展开的新问题；不得因为问题相似、答案较短或主题相同而省略，也不得把多个问题合并成一个概括性问题。每个回答应按原发言顺序尽量保留全部有意义内容，包括事实、背景、原因、过程、判断依据、例子、比较、计算、数字、单位、年份、客户、产品、参数、合作阶段、预测条件、例外和不确定性；只删除“嗯、啊、呃、然后、就是说、这个、那个、对吧”等无信息口头禅、寒暄、重复起句、结巴和不改变含义的重复。把口语改成通顺的书面中文，但不得缩写、概括或改写成结论摘要。使用实体对照表核对姓名和“博士、总”等称谓；只有读音、角色和参考材料能够相互印证时才纠正，不能确认时保留原称谓或写“姓名待确认”。实体对照表仅用于文字校正，不得把BP中未在访谈出现的事实补进Q&A。对夸大或绝对化判断保留具体事实并增加公司归因、细分范围和阶段限定。绝对禁止在Q或A中出现“当前片段、本段、下一段生成、继续处理、下一个片段、以上内容、后续片段、剩余内容”等模型分段或生成流程话术；片段边界对最终读者必须完全不可见。Q和A只写连贯、专业的书面中文，不使用【】、Markdown项目符号、编号提纲或段内小标题。不得添加材料没有的问题或泛化收尾问题。`, `公司：${details.name}\n当前为第${index + 1}/${transcriptChunks.length}个连续片段；只处理本片段，不概括其他片段。\n\n姓名、称谓及术语对照表（只用于纠错）：\n${entityReferenceText}\n\n录音原文片段：\n${chunk}`, 16000, generationAbort.signal);
          let chunkQA = cleanQAItems(qaResult.qa);
          const desiredLength = Math.floor(chunk.length * 0.55);
          if (qaInformationLength(chunkQA) < desiredLength) {
            const expanded = await aiJson(`${meetingInstructions}\n\n你正在执行Q&A明显缺失补全。只输出JSON字段qa。根据原始连续访谈片段补回初稿遗漏的事实、解释、例子、追问、数字、参数、比较、客户阶段、预测条件和限定；不同事实或追问应拆成独立Q&A。扩充只能来自原始片段，不得凭空扩写或用口头禅凑长度。继续按照实体对照表核对姓名、博士/总等称谓和术语；仅在读音、角色和材料能够印证时纠正。禁止【】、Markdown项目符号和编号提纲。`, `公司：${details.name}\n片段 ${index + 1}/${transcriptChunks.length}\n\n姓名、称谓及术语对照表：\n${entityReferenceText}\n\n原始片段：\n${chunk}\n\n初稿：\n${JSON.stringify({ qa: chunkQA })}`, 18000, generationAbort.signal);
            const expandedQA = cleanQAItems(expanded.qa);
            if (qaInformationLength(expandedQA) > qaInformationLength(chunkQA)) chunkQA = expandedQA;
          }
          if (!chunkQA.length) throw new Error(`第${index + 1}段访谈未生成有效Q&A，请重试`);
          return chunkQA;
        }
        for (let start = 0; start < transcriptChunks.length; start += 2) {
          const indexes = Array.from({ length: Math.min(2, transcriptChunks.length - start) }, (_, offset) => start + offset);
          const batchResults = await Promise.all(indexes.map(processTranscriptChunk));
          for (const chunkQA of batchResults) qa.push(...chunkQA);
        }
        for (const key of ["companyPosition", "product", "marketSituation", "coreCustomers", "coreTechnology", "differentiation", "financials", "historicalFinancing", "currentRound", "developmentPlan"]) result[key] = cleanMemoBody(result[key]);
        if (!qa.length) throw new Error("没有生成有效的访谈记录，请检查录音原文是否可读取");
        const forbidden = /作为(?:AI|人工智能)|根据上述流程|本纪要生成|以下是会议纪要/;
        if (Object.values(result).some(value => forbidden.test(String(value)))) throw new Error("AI 输出包含过程性话术，已停止写入，请重试");
        await makeMemoDocx(template, outputFile, details.name, details.metadata.meetingDate || date, details.metadata.participants, result, qa);
        return send(res, 200, { ok: true, message: `会议纪要已生成：${outputFile}`, outputFile, outputFiles: [outputFile] });
      }
      if (body.stage === "项目录入") {
        const workspaceInfo = await inspectWorkspace(body.workspace);
        const templateName = workspaceInfo.excelFiles.find(name => name === "项目表录入.xlsx") || workspaceInfo.excelFiles[0];
        if (!templateName) throw new Error("未找到项目录入模板，请在输入根目录放置《项目表录入.xlsx》");
        const template = path.join(body.workspace, templateName);
        const pendingDir = path.join(dataDir, "pending-intakes");
        await mkdir(pendingDir, { recursive: true });
        const pendingStamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
        outputFile = path.join(pendingDir, `${details.name}-${pendingStamp}-项目录入.xlsx`);
        const styleExample = await firstProjectIntakeStyleExample(template);
        const system = `${intakeInstructions}\n\n你必须完整执行以上Skill。只输出JSON，字段严格为 shortName,establishedDate,city,ipoPlan,previousRound,investors,currentPreMoney,currentFinancing,financingDeadline,mainBusiness,value,revenue,profit,notes。mainBusiness是唯一需要高度精简的产品字段，只写一句产品级短语，不展开型号、参数或状态。value必须严格按照“1.团队、2.股权结构、3.产品、4.技术、5.生产、客户、6.市场、7.收入”七段顺序，每段另起一行，标题文字和标点不得改写；某段无信息时只保留该段标题，不写任何缺失占位语。“1.团队”比其他段稍详细，写3-5位关键成员的姓名、岗位、相关学历或原单位、产业经历及具体分工，但不复制完整简历；“3.产品”必须详细，保留材料中具有实质信息的主要产品线、具体产品或型号、用途、关键参数及量产/供货/送样/在研状态，不得套用mainBusiness的精简限制，只删除完全重复或与主营无关的信息。investors（已投机构）必须尽量完整：按时间和轮次逐行写投资机构及投资金额，不得只保留一两个机构；材料明确机构但没有该轮具体投资金额时，在该行机构名称后写“未披露具体数额”。只有连投资机构本身也没有可靠信息时，investors才输出空字符串。previousRound、investors、currentPreMoney、currentFinancing、financingDeadline 中有多个融资轮次、机构、金额或事项时，使用JSON字符串中的\\n逐项换行，禁止用分号连写，也禁止输出可见的反斜杠和字母n。revenue和profit存在多个年份、实际/预计口径或多个事项时，也必须使用真正的换行逐项呈现。notes只允许写BP与会议纪要/录音之间无法消解的直接冲突，每个冲突以“冲突：”开头并在同一行明确写出BP口径和会议口径；没有此类冲突时notes必须为空字符串。除investors字段对已知机构但未知金额使用“未披露具体数额”外，任何字段无可靠信息都输出空字符串，严禁写“暂无披露、未披露、未提及、材料未说明、待补充、待确认、不详”等占位话术，也不写资料来源、一般缺失项或核查建议，禁止猜测。`;
        const styleSection = styleExample ? `\n\n总表最上面的第一条正式项目行（只模仿写法，禁止复制事实）：\n${styleExample}` : "";
        const result = await aiJson(`${system}\n现有总表的第一条正式项目行只用于模仿字段口径、句式、详略和换行；样例与显式规则冲突时，以显式规则为准。`, `项目：${details.name}\n项目来源：${body.projectSource || details.metadata.projectSource || "待补充"}\n生成日期：${new Date().toLocaleDateString("zh-CN")}${styleSection}\n\n当前项目材料（唯一事实来源）：${materials}`, 12000, generationAbort.signal);
        if (!hasExplicitIpoPlan(materials)) result.ipoPlan = "";
        result.value = String(result.value || "")
          .replace(/([1-7])\s*[.．、]\s*/g, "$1.")
          .replace(/5\.生产(?:和|及|、)客户/g, "5.生产、客户")
          .replace(/\s*(?=(?:2\.股权结构|3\.产品|4\.技术|5\.生产、客户|6\.市场|7\.收入))/g, "\n")
          .replace(/\n{2,}/g, "\n");
        result.value = removeMissingPlaceholders(result.value);
        const labels = ["1.团队", "2.股权结构", "3.产品", "4.技术", "5.生产、客户", "6.市场", "7.收入"];
        let position = -1;
        for (const label of labels) { const next = String(result.value || "").indexOf(label); if (next <= position) throw new Error(`项目价值判断缺少或未按顺序包含“${label}”`); position = next; }
        const now = new Date(); const sourceValue = String(body.projectSource || details.metadata.projectSource || "").trim(); const sourceCell = `${sourceValue ? `项目来源：${sourceValue}\n` : ""}录入时间：${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日`;
        const notes = conflictNotes(result.notes);
        const values = ["", result.shortName || details.name, blankMissing(result.establishedDate), blankMissing(result.city), blankMissing(result.ipoPlan), multilineFinancing(blankMissing(result.previousRound)), detailedInvestors(blankMissing(result.investors)), multilineFinancing(blankMissing(result.currentPreMoney)), multilineFinancing(blankMissing(result.currentFinancing)), multilineFinancing(blankMissing(result.financingDeadline)), blankMissing(result.mainBusiness), result.value, multilineFinancialResult(result.revenue), multilineFinancialResult(result.profit), sourceCell, "", "", notes];
        await appendExcel(template, outputFile, values);
        return send(res, 200, { ok: true, message: "项目录入预览已生成，请检查后确认加入总表", outputFile });
      }
      return send(res, 400, { ok: false, error: "未知生成任务" });
    }
    if (req.method === "POST" && requestUrl.pathname === "/api/intake/confirm") {
      const body = await bodyJson(req);
      const workspaceInfo = await inspectWorkspace(body.workspace);
      const generatedFile = path.resolve(String(body.generatedFile || ""));
      const pendingDir = path.resolve(path.join(dataDir, "pending-intakes"));
      const relative = path.relative(pendingDir, generatedFile);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !/\.xlsx$/i.test(generatedFile)) throw new Error("待确认的项目录入文件无效");
      await access(generatedFile, constants.R_OK);
      const masterName = workspaceInfo.excelFiles.find(name => name === "项目表录入.xlsx");
      if (!masterName) throw new Error("输入根目录未找到《项目表录入.xlsx》");
      const masterFile = path.join(workspaceInfo.path, masterName);
      const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
      const backupFile = path.join(workspaceInfo.path, `项目表录入.备份-${stamp}.xlsx`);
      const temporaryFile = path.join(workspaceInfo.path, `.项目表录入.${process.pid}.tmp.xlsx`);
      await cp(masterFile, backupFile);
      try {
        await cp(generatedFile, temporaryFile);
        await rename(temporaryFile, masterFile);
        await rm(generatedFile, { force: true });
      } catch (error) {
        await rm(temporaryFile, { force: true });
        throw error;
      }
      return send(res, 200, { ok: true, message: "已确认加入项目总表", masterFile, backupFile });
    }
    if (req.method === "POST" && requestUrl.pathname === "/api/intake/discard") {
      const body = await bodyJson(req);
      const generatedFile = path.resolve(String(body.generatedFile || ""));
      const pendingDir = path.resolve(path.join(dataDir, "pending-intakes"));
      const relative = path.relative(pendingDir, generatedFile);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !/\.xlsx$/i.test(generatedFile)) throw new Error("待删除的项目录入预览无效");
      await rm(generatedFile, { force: true });
      return send(res, 200, { ok: true, message: "临时项目录入预览已删除，总表未修改" });
    }
    if (req.method === "POST" && requestUrl.pathname === "/api/ai/config") {
      const body = await bodyJson(req);
      const provider = body.provider === "minimax" ? "minimax" : "deepseek";
      const target = providerInfo(provider);
      const apiKey = String(body.apiKey || aiConfig.apiKeys[provider] || "").trim();
      const model = String(body.model || (provider === "minimax" ? "MiniMax-M2.7" : "deepseek-v4-flash")).trim();
      if (!apiKey) throw new Error(`请输入 ${target.name} API Key`);
      if (!target.models.has(model)) throw new Error("模型配置无效");
      await testAI(provider, apiKey, model);
      aiConfig = { provider, model, apiKeys: { ...aiConfig.apiKeys, [provider]: apiKey }, modelConfigVersion: 2 };
      await mkdir(dataDir, { recursive: true });
      await writeFile(secretsFile, JSON.stringify(aiConfig, null, 2), { mode: 0o600 });
      return send(res, 200, { ok: true, aiConfigured: true, aiProvider: target.name, aiProviderId: provider, aiModel: model });
    }
    return send(res, 404, { ok: false, error: "接口不存在" });
  } catch (error) {
    return send(res, 400, { ok: false, error: error instanceof Error ? error.message : "请求失败" });
  }
});

server.listen(port, host, () => {
  console.log(`本地后端已启动：http://${host}:${port}`);
});
