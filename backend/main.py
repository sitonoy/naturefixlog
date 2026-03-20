from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import psycopg2
import psycopg2.extras
import os
from datetime import datetime, timezone, date, timedelta

app = FastAPI(title="Recovery Spot API")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_DATABASE_URL = os.environ["DATABASE_URL"]
# Supabase は postgres:// を返すが psycopg2 は postgresql:// が必要
DATABASE_URL = _DATABASE_URL.replace("postgres://", "postgresql://", 1) if _DATABASE_URL.startswith("postgres://") else _DATABASE_URL


def get_db():
    return psycopg2.connect(DATABASE_URL)


def cur(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def init_db():
    conn = get_db()
    c = cur(conn)
    c.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            id SERIAL PRIMARY KEY,
            timestamp TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            action_type TEXT NOT NULL,
            intensity INTEGER NOT NULL,
            weather_main TEXT,
            weather_desc TEXT,
            weather_temp REAL,
            note TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    c.close()
    conn.close()


init_db()


class LogCreate(BaseModel):
    lat: float
    lng: float
    action_type: str
    intensity: int
    weather_main: Optional[str] = None
    weather_desc: Optional[str] = None
    weather_temp: Optional[float] = None
    note: Optional[str] = None


class LogResponse(BaseModel):
    id: int
    timestamp: str
    lat: float
    lng: float
    action_type: str
    intensity: int
    weather_main: Optional[str]
    weather_desc: Optional[str]
    weather_temp: Optional[float]
    note: Optional[str]


@app.post("/logs", response_model=LogResponse)
def create_log(log: LogCreate):
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    c = cur(conn)
    c.execute(
        """INSERT INTO logs (timestamp, lat, lng, action_type, intensity,
           weather_main, weather_desc, weather_temp, note)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
           RETURNING *""",
        (now, log.lat, log.lng, log.action_type, log.intensity,
         log.weather_main, log.weather_desc, log.weather_temp, log.note),
    )
    row = c.fetchone()
    conn.commit()
    c.close()
    conn.close()
    return dict(row)


@app.get("/logs", response_model=List[LogResponse])
def get_logs(limit: int = 300):
    conn = get_db()
    c = cur(conn)
    c.execute("SELECT * FROM logs ORDER BY timestamp DESC LIMIT %s", (limit,))
    rows = c.fetchall()
    c.close()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/stats")
def get_stats():
    conn = get_db()
    c = cur(conn)

    c.execute("SELECT COUNT(*) as cnt FROM logs")
    total = c.fetchone()["cnt"]

    c.execute(
        "SELECT action_type, COUNT(*) as cnt, AVG(intensity) as avg_intensity FROM logs GROUP BY action_type"
    )
    by_action = c.fetchall()

    c.execute(
        """SELECT EXTRACT(HOUR FROM timestamp::timestamptz)::INTEGER as hour,
           COUNT(*) as cnt, AVG(intensity) as avg_intensity
           FROM logs GROUP BY hour ORDER BY hour"""
    )
    by_hour = c.fetchall()

    c.execute(
        """SELECT weather_main, COUNT(*) as cnt, AVG(intensity) as avg_intensity
           FROM logs WHERE weather_main IS NOT NULL GROUP BY weather_main"""
    )
    by_weather = c.fetchall()

    c.execute("SELECT DISTINCT timestamp::date as d FROM logs ORDER BY d DESC")
    dates = c.fetchall()
    c.close()
    conn.close()

    streak = 0
    today = date.today()
    for i, row in enumerate(dates):
        d = row["d"]  # psycopg2 は date オブジェクトで返す
        if d == today - timedelta(days=i):
            streak += 1
        else:
            break

    return {
        "total": total,
        "streak": streak,
        "by_action": [dict(r) for r in by_action],
        "by_hour": [dict(r) for r in by_hour],
        "by_weather": [dict(r) for r in by_weather],
    }


@app.get("/recommend")
def get_recommend(mood: str = "疲労", hour: int = 12, weather: str = "Clear"):
    conn = get_db()
    c = cur(conn)
    c.execute("""
        SELECT
            lat, lng,
            action_type,
            AVG(intensity) as avg_i,
            COUNT(*) as cnt,
            MAX(weather_main) as weather_main
        FROM logs
        WHERE intensity >= 2
        GROUP BY ROUND(lat::numeric, 3), ROUND(lng::numeric, 3), action_type
        ORDER BY AVG(intensity) DESC, COUNT(*) DESC
        LIMIT 20
    """)
    rows = c.fetchall()
    c.close()
    conn.close()

    scored = []
    for r in rows:
        d = dict(r)
        score = float(d["avg_i"]) * (float(d["cnt"]) ** 0.5)
        if d.get("weather_main") == weather:
            score *= 1.5
        d["score"] = score
        scored.append(d)

    scored.sort(key=lambda x: x["score"], reverse=True)

    action_ja = {"walk": "歩く", "stay": "座る", "pass": "ふと回復"}
    results = []
    for d in scored[:3]:
        reasons = []
        if d.get("weather_main") == weather:
            reasons.append(f"{weather}の天気と相性◎")
        label = action_ja.get(d["action_type"], d["action_type"])
        reasons.append(f"{label}で平均{float(d['avg_i']):.1f}/3の回復")
        if int(d["cnt"]) > 1:
            reasons.append(f"過去{int(d['cnt'])}回の実績")
        d["reason"] = " · ".join(reasons)
        results.append(d)

    return results


@app.delete("/logs/{log_id}")
def delete_log(log_id: int):
    conn = get_db()
    c = cur(conn)
    c.execute("DELETE FROM logs WHERE id = %s", (log_id,))
    conn.commit()
    c.close()
    conn.close()
    return {"ok": True}
