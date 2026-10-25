const fs=require("fs"),path=require("path"),Database=require("better-sqlite3");
const dataDir=process.env.DATA_DIR||path.join(__dirname,"..","data");fs.mkdirSync(dataDir,{recursive:true});
const db=new Database(path.join(dataDir,"taskflow.sqlite"));db.pragma("journal_mode = WAL");db.pragma("foreign_keys = ON");
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS projects(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY AUTOINCREMENT,project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done')),priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),due_date TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`);
module.exports=db;
