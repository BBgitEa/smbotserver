import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

sqlite3.verbose();


export class Database {
    constructor(dbFileName = 'players.db') {
      const dbPath = path.resolve(__dirname, dbFileName);
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error("Ошибка подключения к БД:", err.message);
        } else {
          this._init();
        }
      });
    }
  
    _init() {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS players (
          name TEXT PRIMARY KEY,
          relationshipLevel INTEGER,
          memories TEXT
        )
      `;
  
      this.db.run(createTableSQL, (err) => {
        if (err) {
          console.error("Ошибка при создании таблицы:", err.message);
        } else {
          console.log("Таблица players готова.");
        }
      });
    }
  
    async getPlayer(name) {
      return new Promise((resolve, reject) => {
        this.db.get(`SELECT * FROM players WHERE name = ?`, [name], (err, row) => {
          if (err) {
            reject("Ошибка при получении игрока: " + err.message);
          } else {
            resolve(row ? {
              name: row.name,
              relationshipLevel: row.relationshipLevel,
              memories: row.memories
            } : null);
          }
        });
      });
    }
  
    async upsertPlayer(playerData) {
      const { name, relationshipLevel, memories } = playerData;
  
      return new Promise((resolve, reject) => {
        this.db.run(`
          INSERT INTO players (name, relationshipLevel, memories)
          VALUES (?, ?, ?)
          ON CONFLICT(name) DO UPDATE SET
            relationshipLevel = excluded.relationshipLevel,
            memories = excluded.memories
        `, [name, relationshipLevel, memories], function (err) {
          if (err) {
            reject("Ошибка при сохранении игрока: " + err.message);
          } else {
            resolve(true);
          }
        });
      });
    }

    async playerExists(name) {
        return new Promise((resolve, reject) => {
          this.db.get(`SELECT 1 FROM players WHERE name = ?`, [name], (err, row) => {
            if (err) {
              reject("Ошибка при проверке игрока: " + err.message);
            } else {
              resolve(!!row);
            }
          });
        });
      }
    
      async createPlayer(name, relationshipLevel = 0, memories = '') {
        const exists = await this.playerExists(name);
        if (exists) {
          throw new Error(`Игрок "${name}" уже существует.`);
        }
    
        return new Promise((resolve, reject) => {
          this.db.run(`
            INSERT INTO players (name, relationshipLevel, memories)
            VALUES (?, ?, ?)
          `, [name, relationshipLevel, memories], function (err) {
            if (err) {
              reject("Ошибка при создании игрока: " + err.message);
            } else {
              resolve(true);
            }
          });
        });
      }
  }