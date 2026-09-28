"""Serwer deweloperski Pengo.

- serwuje pliki gry bez cache (przegladarka zawsze pobiera aktualny JS),
- przechowuje liste najlepszych wynikow w pliku highscores.json obok tego skryptu:
    GET  /api/highscores  -> [{"name", "score", "level"}, ...] od najlepszego
    POST /api/highscores  <- {"name", "score", "level"}  -> {"list": [...], "index": pozycja lub -1}
"""
import http.server
import json
import os
import threading

PORT = 8000
ROOT = os.path.dirname(os.path.abspath(__file__))
SCORES_FILE = os.path.join(ROOT, "highscores.json")
MAX_ENTRIES = 10
MAX_NAME_LENGTH = 10

scores_lock = threading.Lock()


def load_scores():
    try:
        with open(SCORES_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return data[:MAX_ENTRIES] if isinstance(data, list) else []
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def save_scores(scores):
    # zapis do pliku tymczasowego i podmiana - przerwany zapis nie zepsuje listy
    tmp = SCORES_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(scores, f, ensure_ascii=False, indent=2)
    os.replace(tmp, SCORES_FILE)


def add_score(name, score, level):
    with scores_lock:
        scores = load_scores()
        # przy rownym wyniku nowy wpis laduje ponizej starszych
        index = next((i for i, e in enumerate(scores) if score > e["score"]), len(scores))
        scores.insert(index, {"name": name, "score": score, "level": level})
        scores = scores[:MAX_ENTRIES]
        save_scores(scores)
        return scores, index if index < MAX_ENTRIES else -1


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/highscores":
            with scores_lock:
                self.send_json(200, load_scores())
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/highscores":
            self.send_json(404, {"error": "not found"})
            return
        try:
            length = min(int(self.headers.get("Content-Length", 0)), 10_000)
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            name = str(data.get("name", "")).strip()[:MAX_NAME_LENGTH] or "PENGO"
            score = int(data["score"])
            level = int(data.get("level", 1))
            if score < 0 or level < 1:
                raise ValueError
        except (ValueError, KeyError, TypeError, json.JSONDecodeError):
            self.send_json(400, {"error": "bad request"})
            return
        scores, index = add_score(name, score, level)
        self.send_json(200, {"list": scores, "index": index})


if __name__ == "__main__":
    os.chdir(ROOT)
    http.server.ThreadingHTTPServer(("", PORT), Handler).serve_forever()
