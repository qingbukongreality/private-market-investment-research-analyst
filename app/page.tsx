"use client";
import {useEffect,useRef,useState} from "react";
import "./progress.css";
import "./file-list.css";
import "./locations.css";
import "./typography.css";
type Info={path:string;projects:string[];excelFiles:string[];meetingTemplates:string[]};
type FileInfo={name:string;category:string;size:number};
type Detail={metadata:{company:string;meetingDate:string;participants:string;projectSource:string};files:FileInfo[]};
type TaskLog={time:string;project:string;stage:string;status:string;detail:string;duration?:number};
type GeneratedFile={stage:string;path:string;name:string;time:string;committed?:boolean};
const api="http://127.0.0.1:8787",fallback="";
export default function Home(){
 const [path,setPath]=useState(fallback),[draft,setDraft]=useState(fallback),[outputPath,setOutputPath]=useState(fallback),[outputDraft,setOutputDraft]=useState(fallback),[info,setInfo]=useState<Info|null>(null),[project,setProject]=useState(""),[detail,setDetail]=useState<Detail|null>(null);
 const [company,setCompany]=useState(""),[date,setDate]=useState(""),[people,setPeople]=useState(""),[source,setSource]=useState(""),[online,setOnline]=useState(false),[ai,setAi]=useState(false),[provider,setProvider]=useState("deepseek"),[savedProvider,setSavedProvider]=useState("deepseek"),[model,setModel]=useState("deepseek-v4-flash"),[savedModel,setSavedModel]=useState("deepseek-v4-flash"),[modal,setModal]=useState(false),[key,setKey]=useState(""),[busy,setBusy]=useState(""),[notice,setNotice]=useState("");
 const [completed,setCompleted]=useState({minutes:false,intake:false});
 const [pendingStage,setPendingStage]=useState("");
 const [generationError,setGenerationError]=useState("");
 const [overwriteStage,setOverwriteStage]=useState("");
 const [confirmIntakeFile,setConfirmIntakeFile]=useState("");
 const [generatedFiles,setGeneratedFiles]=useState<GeneratedFile[]>([]);
 const [logs,setLogs]=useState<TaskLog[]>([]);
 const [logsOpen,setLogsOpen]=useState(false);
 const [newProjectOpen,setNewProjectOpen]=useState(false),[newProjectName,setNewProjectName]=useState("");
 const input=useRef<HTMLInputElement>(null);
 const generationRequest=useRef<AbortController|null>(null);
 useEffect(()=>{const p=localStorage.getItem("fengyuan-workspace-folder")||fallback,o=localStorage.getItem("fengyuan-output-folder")||p;setPath(p);setDraft(p);setOutputPath(o);setOutputDraft(o);try{setLogs(JSON.parse(localStorage.getItem("fengyuan-task-logs")||"[]"))}catch{}fetch(api+"/api/health").then(r=>r.json()).then(d=>{const selected=d.aiProviderId||"deepseek";setOnline(true);setAi(!!d.aiConfigured);setProvider(selected);setSavedProvider(selected);setModel(d.aiModel||"deepseek-v4-flash");setSavedModel(d.aiModel||"deepseek-v4-flash")}).catch(()=>setOnline(false))},[]);
 useEffect(()=>{if(!online)return;fetch(api+"/api/workspace/inspect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path})}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setInfo(d);setProject(p=>d.projects.includes(p)?p:(d.projects[0]||""))}).catch(e=>setNotice(e.message))},[online,path]);
 async function load(name=project){if(!name)return;const q=new URLSearchParams({workspace:path,name});const r=await fetch(`${api}/api/project?${q}`),d=await r.json();if(!r.ok)throw Error(d.error);setDetail(d);setCompany(d.metadata.company||name);setDate(d.metadata.meetingDate||"");setPeople(d.metadata.participants||"");setSource(d.metadata.projectSource||"")}
 useEffect(()=>{setCompleted({minutes:false,intake:false});load().catch(e=>setNotice(e.message))},[project,path]);
 async function addFiles(files:File[]){if(!files.length||!project)return;setBusy("upload");try{for(const f of files){const q=new URLSearchParams({workspace:path,name:project,filename:f.name});const r=await fetch(`${api}/api/project/upload?${q}`,{method:"POST",headers:{"Content-Type":"application/octet-stream"},body:f});const d=await r.json();if(!r.ok)throw Error(d.error)}await load();setNotice(`已加入 ${files.length} 个文件，材料列表已更新`)}catch(x){setNotice(x instanceof Error?x.message:"上传失败")}finally{setBusy("")}}
 async function upload(e:React.ChangeEvent<HTMLInputElement>){await addFiles([...(e.target.files||[])]);e.target.value=""}
 function addLog(entry:TaskLog){setLogs(current=>{const next=[entry,...current].slice(0,30);localStorage.setItem("fengyuan-task-logs",JSON.stringify(next));return next})}
 async function generate(stage:string,fileMode=""){const started=Date.now(),controller=new AbortController();generationRequest.current=controller;setGenerationError("");setBusy(stage);try{let r=await fetch(api+"/api/project/metadata",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace:path,name:project,meetingDate:date,participants:people,projectSource:source}),signal:controller.signal});let d=await r.json();if(!r.ok)throw Error(d.error);r=await fetch(api+"/api/stage/run",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace:path,outputPath,project,stage,projectSource:source,fileMode}),signal:controller.signal});d=await r.json();if(r.status===409){setOverwriteStage(stage);return}if(!r.ok)throw Error(d.error);setCompleted(c=>({...c,[stage==="会议纪要"?"minutes":"intake"]:true}));setGeneratedFiles(current=>[{stage,path:d.outputFile,name:d.outputFile.split("/").pop(),time:new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})},...current.filter(f=>f.stage!==stage)]);addLog({time:new Date().toLocaleString("zh-CN"),project,stage,status:"成功",detail:d.outputFile,duration:Math.round((Date.now()-started)/1000)});setNotice(d.message||stage+"已生成");await load()}catch(x){const message=x instanceof DOMException&&x.name==="AbortError"?`${stage}已中止`:x instanceof Error?x.message:"生成失败";addLog({time:new Date().toLocaleString("zh-CN"),project,stage,status:message.includes("已中止")?"中止":"失败",detail:message,duration:Math.round((Date.now()-started)/1000)});if(message.includes("已中止"))setNotice(message);else setGenerationError(message)}finally{generationRequest.current=null;setBusy("")}}
 function requestGeneration(stage:string){setGenerationError("");setPendingStage(stage)}
 function stopGeneration(){generationRequest.current?.abort()}
 async function commitIntake(){const filePath=confirmIntakeFile;if(!filePath)return;setBusy("confirmIntake");try{const r=await fetch(api+"/api/intake/confirm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace:path,generatedFile:filePath})}),d=await r.json();if(!r.ok)throw Error(d.error);setGeneratedFiles(current=>current.map(file=>file.path===filePath?{...file,path:d.masterFile,name:"项目表录入.xlsx",committed:true}:file));addLog({time:new Date().toLocaleString("zh-CN"),project,stage:"项目录入",status:"成功",detail:`已确认加入总表；备份：${d.backupFile}`});setConfirmIntakeFile("");setNotice("已加入项目总表，并自动备份原文件");await refreshAll()}catch(x){setGenerationError(x instanceof Error?x.message:"确认录入失败");setConfirmIntakeFile("")}finally{setBusy("")}}
 async function discardIntake(filePath:string){setBusy("discardIntake");try{const r=await fetch(api+"/api/intake/discard",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({generatedFile:filePath})}),d=await r.json();if(!r.ok)throw Error(d.error);setGeneratedFiles(current=>current.filter(file=>file.path!==filePath));setNotice("临时预览已删除，没有加入总表")}catch(x){setGenerationError(x instanceof Error?x.message:"删除预览失败")}finally{setBusy("")}}
 async function createProject(){const name=newProjectName.trim();if(!name)return;setBusy("newProject");try{const r=await fetch(api+"/api/project/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace:path,name})}),d=await r.json();if(!r.ok)throw Error(d.error);setInfo(current=>current?{...current,projects:[...current.projects,name].sort((a,b)=>a.localeCompare(b,"zh-CN"))}:current);setProject(name);setNewProjectName("");setNewProjectOpen(false);setNotice(`已创建项目文件夹：${name}`)}catch(x){setGenerationError(x instanceof Error?x.message:"新建项目失败")}finally{setBusy("")}}
 function outputAction(action:"openOutput"|"revealOutput",filePath:string){const desktop=(window as Window&{dealflowDesktop?:{openOutput:(p:string)=>Promise<string>;revealOutput:(p:string)=>Promise<void>}}).dealflowDesktop;if(!desktop)return setNotice("此功能仅在 Mac App 中可用");desktop[action](filePath)}
async function save(){setBusy("save");try{const replacingKey=!!key.trim(),changingModel=model!==savedModel,changingProvider=provider!==savedProvider;let r=await fetch(api+"/api/workspace/inspect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:draft,save:true})}),d=await r.json();if(!r.ok)throw Error(d.error);r=await fetch(api+"/api/workspace/inspect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:outputDraft})});d=await r.json();if(!r.ok)throw Error(`输出位置：${d.error}`);if(replacingKey||changingModel||changingProvider){r=await fetch(api+"/api/ai/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({apiKey:key,provider,model})});d=await r.json();if(!r.ok)throw Error(d.error);setAi(true);setSavedProvider(provider);setSavedModel(model)}localStorage.setItem("fengyuan-workspace-folder",draft);localStorage.setItem("fengyuan-output-folder",outputDraft);setPath(draft);setOutputPath(outputDraft);setKey("");setModal(false);setNotice(replacingKey||changingModel||changingProvider?"AI 服务商、密钥和模型已测试并保存":"设置已保存")}catch(x){setNotice(x instanceof Error?x.message:"保存失败")}finally{setBusy("")}}
 async function choose(target:"input"|"output"){const d=(window as Window&{dealflowDesktop?:{chooseWorkspace:()=>Promise<string|null>}}).dealflowDesktop;if(!d)return setNotice("网页版请直接输入路径");const p=await d.chooseWorkspace();if(p)(target==="input"?setDraft:setOutputDraft)(p)}
 async function refreshAll(){setBusy("refresh");setGenerationError("");try{const health=await fetch(api+"/api/health"),healthData=await health.json();if(!health.ok)throw Error("本地服务未启动");const selected=healthData.aiProviderId||"deepseek";setOnline(true);setAi(!!healthData.aiConfigured);setProvider(selected);setSavedProvider(selected);setModel(healthData.aiModel||"deepseek-v4-flash");setSavedModel(healthData.aiModel||"deepseek-v4-flash");const response=await fetch(api+"/api/workspace/inspect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path})}),data=await response.json();if(!response.ok)throw Error(data.error);setInfo(data);if(project&&data.projects.includes(project))await load(project);else setProject(data.projects[0]||"");setNotice(`已更新：${data.projects.length} 个项目文件夹`)}catch(x){setOnline(false);setGenerationError(x instanceof Error?x.message:"更新失败")}finally{setBusy("")}}
 const outputs=detail?.files.filter(f=>f.category==="会议纪要"||f.name.includes("项目表"))||[];
 const hasMinutes=completed.minutes||(detail?.files.some(f=>f.category==="会议纪要")||false),hasIntake=completed.intake||(detail?.files.some(f=>f.name.includes("项目表"))||false);
 const hasTranscript=detail?.files.some(f=>["录音原文","修正稿"].includes(f.category))||false,hasBP=detail?.files.some(f=>f.category==="BP/材料")||false;
 const minuteMissing=[!hasTranscript&&"录音原文",!people.trim()&&"参会人",!date&&"会议日期",!(info?.meetingTemplates.length)&&"会议纪要模板.docx"].filter(Boolean) as string[];
 const intakeMissing=[!hasBP&&"BP/项目材料",!source.trim()&&"项目来源",!(info?.excelFiles.length)&&"项目表录入.xlsx"].filter(Boolean) as string[];
 return <main>
<header>
<div className="logo">F</div>
<div className="brand">
<b>投研项目工作台</b>
<small>MEETING & DEALFLOW</small>
</div>
<div className="right">
<span className={online?"live":""}>
<i/>{online?"本地服务正常":"服务未启动"}</span>
<button className="refreshButton" disabled={busy==="refresh"} onClick={refreshAll}>
<i>↻</i>{busy==="refresh"?"更新中":"更新"}</button>
<button onClick={()=>{setKey("");setModal(true)}}>{ai?"更换 API":"配置 API"}</button>
<button onClick={()=>setModal(true)}>更换模型</button>
<button onClick={()=>setModal(true)}>设置</button>
</div>
</header>
 <section className="content">
<div className="intro">
<small>PROJECT WORKSPACE</small>
<h1>材料放进来，结果拿出去。</h1>
<p>选择项目、填写会议信息并上传文件，然后直接生成会议纪要或项目录入。</p>
</div>
 <section className="progress independentProgress">
<div className="progressHead">
<b>任务状态</b>
<span>两项任务可独立执行</span>
</div>
<div className="taskProgressGrid">
<div className={hasMinutes?"taskDone":busy==="会议纪要"?"taskRunning":""}>
<div>
<b>会议纪要</b>
<span>{busy==="会议纪要"?"正在生成":hasMinutes?"已完成":"可单独生成"}</span>
</div>
<i>
<em style={{width:busy==="会议纪要"?"55%":hasMinutes?"100%":"0%"}}/>
</i>
</div>
<div className={hasIntake?"taskDone":busy==="项目录入"?"taskRunning":""}>
<div>
<b>项目录入</b>
<span>{busy==="项目录入"?"正在生成":hasIntake?"已完成":"可单独生成"}</span>
</div>
<i>
<em style={{width:busy==="项目录入"?"55%":hasIntake?"100%":"0%"}}/>
</i>
</div>
</div>
</section>
 <section className="locations">
<div>
<i>IN</i>
<span>
<small>输入文件夹</small>
<b title={path}>{path}</b>
</span>
<button onClick={()=>{setDraft(path);setOutputDraft(outputPath);setModal(true)}}>更改</button>
</div>
<div>
<i>OUT</i>
<span>
<small>输出文件夹</small>
<b title={outputPath}>{outputPath}</b>
</span>
<button onClick={()=>{setDraft(path);setOutputDraft(outputPath);setModal(true)}}>更改</button>
</div>
</section>
 <section className="card inputSection">
<Title no="01" name="输入" sub="填写会议信息并加入本次使用的全部项目资料"/>
<div className="grid">
<label>
<span>项目</span>
<select value={project} onChange={e=>setProject(e.target.value)}>
<option value="">选择项目</option>{info?.projects.map(x=>
<option key={x}>{x}</option>)}</select>
</label>
<label>
<span>公司名称</span>
<input value={company} onChange={e=>setCompany(e.target.value)}/>
</label>
<label>
<span>会议日期</span>
<input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
</label>
<label className="people">
<span>参会人</span>
<input value={people} onChange={e=>setPeople(e.target.value)} placeholder="投资方：张三、李四；项目方：王五、赵六"/>
</label>
<label className="sourceLine">
<span>项目来源 <em>将写入项目录入表 O 列</em>
</span>
<input value={source} onChange={e=>setSource(e.target.value)} placeholder="例如：产业方推荐、FA、校友推荐、主动挖掘"/>
</label>
</div>
 <button className="newProjectButton" onClick={()=>setNewProjectOpen(true)}>＋ 新建项目文件夹</button>
<button className="drop" disabled={!project||busy==="upload"} onClick={()=>input.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();addFiles([...e.dataTransfer.files])}}>
<i>＋</i>
<span>
<b>{busy==="upload"?"正在加入文件…":"拖入或选择项目材料"}</b>
<small>录音、录音原文、BP、简介及补充材料</small>
</span>
<em>选择文件</em>
</button>
<div className="readiness">
<div className={minuteMissing.length?"needs":"ready"}>
<b>会议纪要</b>
<span>{minuteMissing.length?`建议补充：${minuteMissing.join("、")}`:"输入已齐备"}</span>
</div>
<div className={intakeMissing.length?"needs":"ready"}>
<b>项目录入</b>
<span>{intakeMissing.length?`建议补充：${intakeMissing.join("、")}`:"输入已齐备"}</span>
</div>
</div>
<div className="fileHead">
<b>项目文件夹内的文件</b>
<span>{detail?.files.length||0} 个</span>
</div>{!!detail?.files.length?<div className="files">{detail.files.map(f=>
<div key={f.name}>
<span>{f.category}</span>
<b>{f.name}</b>
<small>{(f.size/1048576).toFixed(1)} MB</small>
</div>)}</div>:<div className="emptyFiles">该项目文件夹内暂时没有材料</div>}<input ref={input} hidden multiple type="file" onChange={upload}/>
</section>
 <section className="card output">
<Title no="02" name="独立输出" sub={`任选一项生成，结果保存至：${outputPath}`}/>
<div className="actions">
<button className="dark" disabled={!project||!!busy||!online} onClick={()=>requestGeneration("会议纪要")}>
<b>会议纪要</b>
<span>{busy==="会议纪要"?"生成中…":"独立生成 Word →"}</span>
</button>
<button disabled={!project||!!busy||!online} onClick={()=>requestGeneration("项目录入")}>
<b>项目录入</b>
<span>{busy==="项目录入"?"生成中…":"独立写入 Excel →"}</span>
</button>
</div>{(busy==="会议纪要"||busy==="项目录入")&&<button className="stopButton" onClick={stopGeneration}>
<i/>中止 {busy}</button>}{!ai&&<p className="hint">首次使用前，请在右上角“设置”中选择 AI 服务商并填写 API Key。</p>}{generationError&&<section className="errorPanel">
<div>
<i>!</i>
<span>
<b>生成失败</b>
<p>{generationError}</p>
<small>{generationError.includes("API")||generationError.includes("401")?"请在设置中重新填写当前 AI 服务商的 API Key。":generationError.includes("文字材料")?"请加入录音原文、BP、简介或其他可读取的文字文件。":generationError.includes("会议纪要模板")?"请确认输入文件夹根目录存在《会议纪要模板.docx》。":generationError.includes("Excel")||generationError.includes("项目录入模板")?"请确认输入文件夹根目录存在《项目表录入.xlsx》。":"请检查网络、文件权限和输入材料后重试。"}</small>
</span>
</div>
<button onClick={()=>setGenerationError("")}>关闭</button>
</section>}{generatedFiles.length>0&&<div className="generatedList">{generatedFiles.map(file=>
<div key={file.stage}>
<span>
<b>{file.name}</b>
<small>{file.stage} · {file.time}</small>
</span>
<button onClick={()=>outputAction("openOutput",file.path)}>打开</button>
<button onClick={()=>outputAction("revealOutput",file.path)}>Finder</button>
{file.stage==="项目录入"&&<button disabled={file.committed||busy==="confirmIntake"} onClick={()=>setConfirmIntakeFile(file.path)}>{file.committed?"已加入总表":"确认加入总表"}</button>}
{file.stage==="项目录入"?!file.committed&&<button disabled={busy==="discardIntake"} onClick={()=>discardIntake(file.path)}>不加入总表，删除</button>:<button onClick={()=>requestGeneration(file.stage)}>重新生成</button>}
</div>)}</div>}<button className="logsButton" onClick={()=>setLogsOpen(!logsOpen)}>任务日志 <span>{logs.length}</span>
</button>{logsOpen&&<div className="taskLogs">{logs.length?logs.map((log,i)=>
<div key={i}>
<span className={log.status}>{log.status}</span>
<b>{log.project} · {log.stage}</b>
<small>{log.time}{log.duration!==undefined?` · ${log.duration}秒`:""}</small>
<p>{log.detail}</p>
</div>):<p>暂无任务记录</p>}</div>}</section>
</section>
 {modal&&<div className="modal" onMouseDown={e=>e.target===e.currentTarget&&setModal(false)}>
<section>
<div className="modalTitle">
<div>
<small>SETTINGS</small>
<h2>文件、API 与模型</h2>
</div>
<button onClick={()=>setModal(false)}>×</button>
</div>
<label>
<span>输入文件位置</span>
<div className="path">
<input value={draft} onChange={e=>setDraft(e.target.value)}/>
<button onClick={()=>choose("input")}>选择</button>
</div>
</label>
<label>
<span>输出文件位置</span>
<div className="path">
<input value={outputDraft} onChange={e=>setOutputDraft(e.target.value)}/>
<button onClick={()=>choose("output")}>选择</button>
</div>
</label>
<label>
<span>AI 服务商</span>
<select value={provider} onChange={e=>{const next=e.target.value;setProvider(next);setModel(next==="minimax"?"MiniMax-M2.7":"deepseek-v4-flash");setKey("")}}>
<option value="deepseek">DeepSeek</option>
<option value="minimax">MiniMax</option>
</select>
</label>
<label>
<span>{provider==="minimax"?"MiniMax":"DeepSeek"} API Key {ai&&provider===savedProvider&&<em>已配置 · 可更换</em>}</span>
<input type="password" value={key} onChange={e=>setKey(e.target.value)} placeholder={ai&&provider===savedProvider?"输入新密钥即可替换；留空保持不变":"sk-…"}/>
</label>
<label>
<span>模型</span>
<select value={model} onChange={e=>setModel(e.target.value)}>
{provider==="minimax"?<>
<option value="MiniMax-M2.7">MiniMax M2.7 · 标准速度</option>
<option value="MiniMax-M2.7-highspeed">MiniMax M2.7 Highspeed · 更快</option>
</>:<>
<option value="deepseek-v4-flash">DeepSeek V4 Flash · 费用较低</option>
<option value="deepseek-v4-pro">DeepSeek V4 Pro · 质量优先</option>
</>}
</select>
</label>
<small className="consentNote">当前使用：{savedProvider==="minimax"?"MiniMax":"DeepSeek"} · {savedModel}。切换服务商、密钥或模型时会先测试连接，成功后才保存。</small>
<footer>
<button onClick={()=>{setProvider(savedProvider);setModel(savedModel);setKey("");setModal(false)}}>取消</button>
<button className="dark" onClick={save}>{busy==="save"?"正在测试并保存…":"测试并保存"}</button>
</footer>
</section>
</div>}{pendingStage&&<div className="modal consentModal" onMouseDown={e=>e.target===e.currentTarget&&setPendingStage("")}>
<section>
<div className="modalTitle">
<div>
<small>DATA NOTICE</small>
<h2>确认生成{pendingStage}</h2>
</div>
<button onClick={()=>setPendingStage("")}>×</button>
</div>
<div className="consentLead">
<i>↗</i>
<div>
<b>文字材料将发送至 {savedProvider==="minimax"?"MiniMax":"DeepSeek"}</b>
<p>{pendingStage==="项目录入"?"先生成临时预览，确认后才加入总表。":"用于分析并生成本次会议纪要。"}</p>
</div>
</div>
<div className="consentRows">
<p>
<b>会发送</b>
<span>录音原文、BP、简介、补充文字材料及填写的信息</span>
</p>
<p>
<b>不会发送</b>
<span>音频、图片、API Key、输入和输出文件夹路径</span>
</p>
</div>
<small className="consentNote">{pendingStage==="项目录入"?"生成预览不会修改总表；确认加入时会自动备份。":""} 请确认项目材料允许提交至你配置的 {savedProvider==="minimax"?"MiniMax":"DeepSeek"} API 账户。</small>
<footer>
<button onClick={()=>setPendingStage("")}>取消</button>
<button className="dark" onClick={()=>{const stage=pendingStage;setPendingStage("");generate(stage)}}>确认并开始生成</button>
</footer>
</section>
</div>}{confirmIntakeFile&&<div className="modal">
<section>
<div className="modalTitle">
<div><small>CONFIRM INTAKE</small><h2>确认加入项目总表</h2></div>
<button onClick={()=>setConfirmIntakeFile("")}>×</button>
</div>
<p className="overwriteText">请先打开并检查预览文件。确认后将更新输入根目录的《项目表录入.xlsx》，自动备份原总表，并删除临时预览。</p>
<footer>
<button onClick={()=>setConfirmIntakeFile("")}>取消</button>
<button className="dark" disabled={busy==="confirmIntake"} onClick={commitIntake}>{busy==="confirmIntake"?"正在加入…":"确认加入"}</button>
</footer>
</section>
</div>}{overwriteStage&&<div className="modal">
<section>
<div className="modalTitle">
<div>
<small>FILE EXISTS</small>
<h2>输出文件已存在</h2>
</div>
<button onClick={()=>setOverwriteStage("")}>×</button>
</div>
<p className="overwriteText">请选择如何保存新的{overwriteStage}。覆盖后原文件无法恢复。</p>
<footer>
<button onClick={()=>setOverwriteStage("")}>取消</button>
<button onClick={()=>{const s=overwriteStage;setOverwriteStage("");generate(s,"version")}}>生成新版本</button>
<button className="dark" onClick={()=>{const s=overwriteStage;setOverwriteStage("");generate(s,"overwrite")}}>覆盖原文件</button>
</footer>
</section>
</div>}{newProjectOpen&&<div className="modal">
<section>
<div className="modalTitle">
<div>
<small>NEW PROJECT</small>
<h2>新建项目</h2>
</div>
<button onClick={()=>setNewProjectOpen(false)}>×</button>
</div>
<label>
<span>项目或公司名称</span>
<input autoFocus value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createProject()} placeholder="例如：某某科技"/>
</label>
<small className="consentNote">将在输入文件夹下创建同名项目文件夹。</small>
<footer>
<button onClick={()=>setNewProjectOpen(false)}>取消</button>
<button className="dark" disabled={!newProjectName.trim()||busy==="newProject"} onClick={createProject}>{busy==="newProject"?"创建中…":"创建项目"}</button>
</footer>
</section>
</div>}{notice&&<div className="toast">{notice}<button onClick={()=>setNotice("")}>×</button>
</div>}</main>}
function Title({no,name,sub}:{no:string;name:string;sub:string}){return <div className="title">
<i>{no}</i>
<div>
<h2>{name}</h2>
<p>{sub}</p>
</div>
</div>}
