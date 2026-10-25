require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const os = require("os");
const db = require("./src/db");
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const VERSION = process.env.APP_VERSION || "1.0.0";
app.disable("x-powered-by");
app.use(express.json({limit:"100kb"}));
app.use(express.urlencoded({extended:false}));
app.use(session({name:"taskflow.sid",secret:process.env.SESSION_SECRET||"local-dev-secret-change-this",resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:"lax",secure: process.env.COOKIE_SECURE === "true",maxAge:8*60*60*1000}}));
app.use(express.static(path.join(__dirname,"public")));
function userFor(req){return req.session.userId?db.prepare("SELECT id,name,email FROM users WHERE id=?").get(req.session.userId)||null:null;}
function auth(req,res,next){const user=userFor(req);if(!user)return res.status(401).json({error:"Please log in first."});req.user=user;next();}
function text(v,max=2000){return typeof v==="string"?v.trim().slice(0,max):"";}
function validEmail(v){return typeof v==="string"&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);}
app.get("/api/health",(_req,res)=>res.json({status:"healthy",version:VERSION,uptimeSeconds:Math.floor(process.uptime())}));
app.get("/api/ready",(_req,res)=>{try{db.prepare("SELECT 1").get();res.json({status:"ready"});}catch{res.status(503).json({status:"not_ready"});}});
app.get("/api/info",(_req,res)=>res.json({name:"FlowForge",version:VERSION,environment:process.env.NODE_ENV||"development",nodeVersion:process.version,hostname:os.hostname()}));
app.get("/api/metrics",(_req,res)=>{const mem=process.memoryUsage();const users=db.prepare("SELECT COUNT(*) n FROM users").get().n;const tasks=db.prepare("SELECT COUNT(*) n FROM tasks").get().n;res.type("text/plain; version=0.0.4; charset=utf-8").send(["# HELP flowforge_uptime_seconds Process uptime in seconds","# TYPE flowforge_uptime_seconds gauge",`flowforge_uptime_seconds ${process.uptime()}`,"# HELP flowforge_memory_rss_bytes Resident memory bytes","# TYPE flowforge_memory_rss_bytes gauge",`flowforge_memory_rss_bytes ${mem.rss}`,"# HELP flowforge_users_total Registered users","# TYPE flowforge_users_total gauge",`flowforge_users_total ${users}`,"# HELP flowforge_tasks_total Tasks stored","# TYPE flowforge_tasks_total gauge",`flowforge_tasks_total ${tasks}`].join("\n")+"\n");});
app.get("/api/auth/me",(req,res)=>res.json({user:userFor(req)}));
app.post("/api/auth/register",async(req,res,next)=>{try{const name=text(req.body.name,80),email=text(req.body.email,254).toLowerCase(),password=req.body.password;if(name.length<2)return res.status(400).json({error:"Name must contain at least 2 characters."});if(!validEmail(email))return res.status(400).json({error:"Enter a valid email address."});if(typeof password!=="string"||password.length<8||password.length>72)return res.status(400).json({error:"Password must be 8–72 characters."});if(db.prepare("SELECT id FROM users WHERE email=?").get(email))return res.status(409).json({error:"An account with this email already exists."});const hash=await bcrypt.hash(password,10);const result=db.prepare("INSERT INTO users(name,email,password_hash) VALUES(?,?,?)").run(name,email,hash);req.session.userId = Number(result.lastInsertRowid);

req.session.save((err) => {
  if (err) return next(err);
  res.status(201).json({ user: userFor(req) });
});}catch(e){next(e);}});
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = text(req.body.email, 254).toLowerCase();
    const password = req.body.password;

    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email);

    if (
      !user ||
      typeof password !== "string" ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    req.session.userId = user.id;

    req.session.save((err) => {
      if (err) return next(err);

      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    });
  } catch (e) {
    next(e);
  }
});
app.post("/api/auth/logout",(req,res)=>req.session.destroy(()=>{res.clearCookie("taskflow.sid");res.status(204).end();}));
app.get("/api/projects",auth,(req,res)=>{const projects=db.prepare("SELECT p.*,COUNT(t.id) task_count,SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) completed_count FROM projects p LEFT JOIN tasks t ON t.project_id=p.id WHERE p.user_id=? GROUP BY p.id ORDER BY p.updated_at DESC").all(req.user.id);res.json({projects:projects.map(p=>({...p,task_count:p.task_count||0,completed_count:p.completed_count||0,progress:p.task_count?Math.round((p.completed_count||0)/p.task_count*100):0}))});});
app.post("/api/projects",auth,(req,res)=>{const name=text(req.body.name,100),description=text(req.body.description,1000);if(name.length<2)return res.status(400).json({error:"Project name must contain at least 2 characters."});const result=db.prepare("INSERT INTO projects(user_id,name,description) VALUES(?,?,?)").run(req.user.id,name,description);res.status(201).json({project:db.prepare("SELECT * FROM projects WHERE id=? AND user_id=?").get(result.lastInsertRowid,req.user.id)});});
app.patch("/api/projects/:id",auth,(req,res)=>{const id=Number(req.params.id),name=text(req.body.name,100),description=text(req.body.description,1000);const p=db.prepare("SELECT * FROM projects WHERE id=? AND user_id=?").get(id,req.user.id);if(!p)return res.status(404).json({error:"Project not found."});if(req.body.name!==undefined&&name.length<2)return res.status(400).json({error:"Project name must contain at least 2 characters."});db.prepare("UPDATE projects SET name=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").run(req.body.name===undefined?p.name:name,req.body.description===undefined?p.description:description,id,req.user.id);res.json({project:db.prepare("SELECT * FROM projects WHERE id=? AND user_id=?").get(id,req.user.id)});});
app.delete("/api/projects/:id",auth,(req,res)=>{const r=db.prepare("DELETE FROM projects WHERE id=? AND user_id=?").run(Number(req.params.id),req.user.id);if(!r.changes)return res.status(404).json({error:"Project not found."});res.status(204).end();});
app.get("/api/tasks",auth,(req,res)=>{const status=text(req.query.status,20),priority=text(req.query.priority,20),search=text(req.query.search,100);const statuses=["todo","in_progress","done"],priorities=["low","medium","high"];let sql="SELECT t.*,p.name AS project_name FROM tasks t JOIN projects p ON p.id=t.project_id WHERE p.user_id=?";const args=[req.user.id];if(status){if(!statuses.includes(status))return res.status(400).json({error:"Invalid status filter."});sql+=" AND t.status=?";args.push(status);}if(priority){if(!priorities.includes(priority))return res.status(400).json({error:"Invalid priority filter."});sql+=" AND t.priority=?";args.push(priority);}if(search){sql+=" AND (t.title LIKE ? OR t.description LIKE ?)";args.push(`%${search}%`,`%${search}%`);}sql+=" ORDER BY CASE t.status WHEN 'todo' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END,t.created_at DESC";res.json({tasks:db.prepare(sql).all(...args)});});
app.post("/api/tasks",auth,(req,res)=>{const projectId=Number(req.body.projectId),title=text(req.body.title,120),description=text(req.body.description,2000),priority=req.body.priority||"medium",dueDate=req.body.dueDate||null;if(title.length<2)return res.status(400).json({error:"Task title must contain at least 2 characters."});if(!["low","medium","high"].includes(priority))return res.status(400).json({error:"Priority must be low, medium, or high."});if(dueDate!==null&&(typeof dueDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||Number.isNaN(Date.parse(dueDate))))return res.status(400).json({error:"Due date must use YYYY-MM-DD."});if(!db.prepare("SELECT id FROM projects WHERE id=? AND user_id=?").get(projectId,req.user.id))return res.status(400).json({error:"Choose one of your own projects."});const r=db.prepare("INSERT INTO tasks(project_id,title,description,priority,due_date) VALUES(?,?,?,?,?)").run(projectId,title,description,priority,dueDate);res.status(201).json({task:db.prepare("SELECT * FROM tasks WHERE id=?").get(r.lastInsertRowid)});});
app.patch("/api/tasks/:id",auth,(req,res)=>{const id=Number(req.params.id),t=db.prepare("SELECT t.* FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=? AND p.user_id=?").get(id,req.user.id);if(!t)return res.status(404).json({error:"Task not found."});const title=req.body.title===undefined?t.title:text(req.body.title,120),description=req.body.description===undefined?t.description:text(req.body.description,2000),status=req.body.status===undefined?t.status:req.body.status,priority=req.body.priority===undefined?t.priority:req.body.priority,dueDate=req.body.dueDate===undefined?t.due_date:(req.body.dueDate||null);if(title.length<2)return res.status(400).json({error:"Task title must contain at least 2 characters."});if(!["todo","in_progress","done"].includes(status))return res.status(400).json({error:"Invalid task status."});if(!["low","medium","high"].includes(priority))return res.status(400).json({error:"Invalid priority."});if(dueDate!==null&&(typeof dueDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||Number.isNaN(Date.parse(dueDate))))return res.status(400).json({error:"Due date must use YYYY-MM-DD."});db.prepare("UPDATE tasks SET title=?,description=?,status=?,priority=?,due_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(title,description,status,priority,dueDate,id);res.json({task:db.prepare("SELECT * FROM tasks WHERE id=?").get(id)});});
app.delete("/api/tasks/:id",auth,(req,res)=>{const r=db.prepare("DELETE FROM tasks WHERE id IN (SELECT t.id FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=? AND p.user_id=?)").run(Number(req.params.id),req.user.id);if(!r.changes)return res.status(404).json({error:"Task not found."});res.status(204).end();});
app.use("/api",(req,res)=>res.status(404).json({error:"API route not found."}));
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:"Internal server error."});});
if(require.main===module){const server=app.listen(PORT,"0.0.0.0",()=>console.log(`FlowForge running at http://localhost:${PORT}`));const shutdown=()=>server.close(()=>{db.close();process.exit(0);});process.on("SIGTERM",shutdown);process.on("SIGINT",shutdown);}
module.exports=app;
