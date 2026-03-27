const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-ByQup5yq.js","assets/index-ZhJKD1yL.css"])))=>i.map(i=>d[i]);
var S=Object.defineProperty;var y=(u,e,t)=>e in u?S(u,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):u[e]=t;var p=(u,e,t)=>y(u,typeof e!="symbol"?e+"":e,t);import{u as x,a as w,l as T,_ as f,s as $,b as E,c as C,d as P}from"./index-ByQup5yq.js";const _=Object.freeze(Object.defineProperty({__proto__:null,useChatStore:w,useConfigStore:E,useLive2dStore:C,useMemoryStore:P,useTaskStore:x},Symbol.toStringTag,{value:"Module"}));function k(){return`practice_${Date.now()}_${Math.random().toString(36).substring(2,8)}`}function v(u){return new Set(u.map(t=>t.type)).size===1?u[0].type:"混合练习"}function I(u){return u>=.9?"优秀":u>=.7?"良好":u>=.5?"一般":"需加强"}function b(u,e){const t=u*60/e;return t<30?"快速":t<60?"适中":"较慢"}class A{constructor(){p(this,"session",null);p(this,"chatStore",w())}async startPractice(e){let s=(await T()).exercises;if(e&&e.length>0&&(s=s.filter(n=>e.includes(n.id))),s.length===0){const n="抱歉，没有找到可练习的题目。请先让家长上传试卷哦！📚";this.chatStore.addAssistantMessage(n),await this.chatStore.speakText(n);return}this.session={exercises:s,currentIndex:0,answers:new Map,results:new Map,startTime:new Date};const r=`你准备好了吗？我们现在开始了哦！🎉

共有 ${s.length} 道题目。`;this.chatStore.addAssistantMessage(r),await this.chatStore.speakText(r),await new Promise(n=>setTimeout(n,1e3)),await this.showCurrentQuestion()}async showCurrentQuestion(){if(!this.session)return;const e=this.session.exercises[this.session.currentIndex];let s=`第 ${this.session.currentIndex+1} 题，`;s+=`(${e.type}) `,s+=`${e.question}`,e.images&&e.images.length>0&&(s+=`

[本题包含 ${e.images.length} 张图片，请查看屏幕下方图片区域]`),e.type==="选择题"&&e.options&&(s+=`
`,e.options.forEach((r,n)=>{s+=`${String.fromCharCode(65+n)}. ${r}  `})),this.chatStore.addAssistantMessage(s),await this.chatStore.speakText(s)}async submitAnswer(e){if(!this.session)return;const t=this.session.exercises[this.session.currentIndex];this.session.answers.set(t.id,e),this.chatStore.addUserMessage(e);const s=await this.evaluateAnswer(t,e);this.session.results.set(t.id,s),this.chatStore.addAssistantMessage(s.feedback),await this.chatStore.speakText(s.feedback),await new Promise(r=>setTimeout(r,1500)),this.session.currentIndex++,this.session.currentIndex<this.session.exercises.length?await this.showCurrentQuestion():await this.finishPractice()}async evaluateAnswer(e,t){const s=this.buildEvaluationPrompt(e,t);try{const r=await this.chatStore.generateResponse(s);if(this.checkAnswerCorrectness(r)){const o=["太棒了！你算对了！","完全正确！","真厉害！答对了！","非常好！正确！","很棒！继续加油！"];return{isCorrect:!0,feedback:o[Math.floor(Math.random()*o.length)]}}return{isCorrect:!1,feedback:r}}catch(r){return console.error("Failed to evaluate answer:",r),{isCorrect:!1,feedback:"抱歉，判断答案时出错了。让我们继续下一题吧！"}}}checkAnswerCorrectness(e){const t=e.toLowerCase(),s=["正确","对了","答对了","算对了","做对了","完全正确","完全对","答得对","✅","✓","√","对的","是对的"],r=["有些问题","不对","差一点","算错了","不太对","不正确","❌","✗","有点问题"];for(const n of r)if(t.includes(n.toLowerCase()))return!1;for(const n of s)if(t.includes(n.toLowerCase()))return!0;return!1}buildEvaluationPrompt(e,t){let s=`你是一位耐心的老师，正在批改学生的作业。

`;return s+=`题目类型：${e.type}
`,s+=`题目内容：${e.question}
`,e.type==="选择题"&&e.options&&(s+=`选项：
`,e.options.forEach((r,n)=>{s+=`${String.fromCharCode(65+n)}. ${r}
`})),s+=`
正确答案：${e.answer||"（需要计算）"}
`,s+=`学生答案：${t}

`,s+=`如果学生的答案错误，请：
`,s+=`1. 温和地指出错误
`,s+=`2. 给出正确答案
`,s+=`3. 提供解题思路
`,s+=`4. 反馈要简洁（不超过80字），适合小学生理解
`,s+=`5. 使用中文回复

`,s+="请直接给出反馈，不要有其他内容。",s}async finishPractice(){if(!this.session)return;this.session.endTime=new Date;const e=this.session.exercises.length,t=Array.from(this.session.results.values()).filter(a=>a.isCorrect).length,s=e-t;await this.updateExerciseStatus(),await this.updateRelatedTaskStatus(),await this.savePracticeRecord(e,t,s);const r=this.generatePracticeSummary(e,t,s);await this.savePracticeSummaryToMemory(r);const o=await this.generateSummaryWithLLM(e,t,s)||this.generateFallbackSummary(e,t,s);this.chatStore.addAssistantMessage(o),await this.chatStore.speakText(o),this.session=null}async updateExerciseStatus(){if(!this.session)return;const{loadExercises:e,saveExercises:t}=await f(async()=>{const{loadExercises:r,saveExercises:n}=await import("./index-ByQup5yq.js").then(o=>o.e);return{loadExercises:r,saveExercises:n}},__vite__mapDeps([0,1])),s=await e();for(const r of this.session.exercises){const n=this.session.results.get(r.id),o=this.session.answers.get(r.id),a=s.exercises.findIndex(d=>d.id===r.id);a!==-1&&(s.exercises[a]={...s.exercises[a],status:"completed",userAnswer:o||"",isCorrect:(n==null?void 0:n.isCorrect)||!1,completedAt:new Date().toISOString()})}await t(s)}async updateRelatedTaskStatus(){if(!this.session)return;const{useTaskStore:e}=await f(async()=>{const{useTaskStore:n}=await Promise.resolve().then(()=>_);return{useTaskStore:n}},void 0),t=e(),s=this.session.exercises.map(n=>n.id),r=t.tasks.find(n=>n.exerciseIds&&n.exerciseIds.some(o=>s.includes(o))&&n.status==="未完成");r&&await t.completeTask(r.id)}async savePracticeRecord(e,t,s){if(!this.session)return;const{addExerciseRecord:r}=await f(async()=>{const{addExerciseRecord:o}=await import("./index-ByQup5yq.js").then(a=>a.e);return{addExerciseRecord:o}},__vite__mapDeps([0,1])),n=this.session.exercises.filter(o=>{const a=this.session.results.get(o.id);return a&&!a.isCorrect});await r({date:new Date().toISOString().split("T")[0],score:t,total:e,weakPoints:n.map(o=>o.type)})}generatePracticeSummary(e,t,s){if(!this.session||!this.session.endTime)throw new Error("No active practice session");const r=Math.round((this.session.endTime.getTime()-this.session.startTime.getTime())/6e4),n=e>0?t/e:0,o=this.session.exercises.map(i=>{const h=this.session.results.get(i.id),g=this.session.answers.get(i.id);return{exerciseId:i.id,questionType:i.type,question:i.question,userAnswer:g||"",correctAnswer:i.answer||"",isCorrect:(h==null?void 0:h.isCorrect)||!1,feedback:h==null?void 0:h.feedback,relatedTopic:i.chapter||i.subject}}),a=this.session.exercises.filter(i=>{const h=this.session.results.get(i.id);return h&&!h.isCorrect}),d=this.session.exercises.filter(i=>{const h=this.session.results.get(i.id);return h&&h.isCorrect}),l=[...new Set(a.map(i=>i.chapter||i.subject).filter(Boolean))],m=[...new Set(d.map(i=>i.chapter||i.subject).filter(Boolean))],c=[...new Set(this.session.exercises.map(i=>i.chapter||i.subject).filter(Boolean))];return{sessionId:k(),practiceType:v(this.session.exercises),startTime:this.session.startTime.toISOString(),endTime:this.session.endTime.toISOString(),duration:r,totalQuestions:e,completedQuestions:e,correctCount:t,wrongCount:s,accuracy:n,performance:I(n),speedRating:b(r,e),questionResults:o,relatedTopics:c,masteredTopics:m,weakTopics:l,keyFindings:[],improvementSuggestions:[],nextSteps:[]}}async savePracticeSummaryToMemory(e){try{await $.savePracticeSummary(e),console.log(`[自主练习] 练习总结已保存到短期记忆: ${e.sessionId}`)}catch(t){console.error("[自主练习] 保存练习总结失败:",t)}}generateFallbackSummary(e,t,s){let r=`你真棒，全部题目都完成啦！🎉

`;return r+=`**成绩单**
`,r+=`- 总题数：${e}
`,r+=`- 正确数：${t}
`,r+=`- 错误数：${s}

`,s>0?(r+=`这次你有 ${s} 题做错了，加油！💪
`,r+="是否要我帮你找一些类似的题目来巩固一下呀？"):(r+=`太棒了！你全部答对了！🌟
`,r+="继续保持，你真是一个学习小能手！"),r}async generateSummaryWithLLM(e,t,s){var m;const r=this.session.exercises.filter(c=>{const i=this.session.results.get(c.id);return i&&!i.isCorrect}),n=this.session.exercises.filter(c=>{const i=this.session.results.get(c.id);return i&&i.isCorrect}),{loadMemory:o}=await f(async()=>{const{loadMemory:c}=await import("./index-ByQup5yq.js").then(i=>i.e);return{loadMemory:c}},__vite__mapDeps([0,1])),a=await o(),d=((m=a==null?void 0:a.profile)==null?void 0:m.name)||"宝贝";let l=`你是一位品学兼优且极具耐心的好学生，你正在辅导你最好的朋友${d}学习，你们刚刚完成了一次练习。

【重要规则】
- 必须使用"${d}"称呼用户，绝对不要使用其他名字如"小明"、"小红"等
- 对于答对的题目，只需要说"真棒"或"继续保持"等简单鼓励，不要讲解解题过程
- 只对答错的题目进行讲解

练习情况：
- 总题数：${e}
- 正确数：${t}
- 错误数：${s}
`;n.length>0&&(l+=`
答对的题目（共${n.length}题，只需简单鼓励，不要讲解）：
`,n.forEach((c,i)=>{l+=`${i+1}. ${c.question}
`})),r.length>0&&(l+=`
做错的题目（共${r.length}题，需要讲解）：
`,r.forEach((c,i)=>{const h=this.session.answers.get(c.id);l+=`${i+1}. ${c.question}
`,l+=`   学生答案：${h}
`,l+=`   正确答案：${c.answer}

`})),l+=`
请生成一段总结报告，要求：
1. 首先表扬${d}完成了所有题目
2. 对于答对的题目，只说"${d}真棒，这些题都对了！"之类的话，不要讲解
3. 只对做错的题目进行讲解，给出正确答案和解题思路
4. 语气要友好、亲切，像朋友一样
5. 不超过100字`;try{return await this.chatStore.generateResponse(l)}catch(c){console.error("Failed to generate summary:",c);let i=`${d}，你真棒，全部题目都完成啦！🎉

`;return i+=`**成绩单**
`,i+=`- 总题数：${e}
`,i+=`- 正确数：${t}
`,i+=`- 错误数：${s}

`,s>0?(i+=`这次你有 ${s} 题做错了，加油！💪
`,i+="是否要我帮你找一些类似的题目来巩固一下呀？"):(i+=`太棒了！你全部答对了！🌟
`,i+="继续保持，你真是一个学习小能手！"),i}}getCurrentProgress(){return this.session?{current:this.session.currentIndex+1,total:this.session.exercises.length}:null}isActive(){return this.session!==null}stopPractice(){this.session=null}}const L=new A;export{A as SelfPracticeSkill,L as selfPracticeSkill};
