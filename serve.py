"""Serwer deweloperski bez cache - przegladarka zawsze pobiera aktualne pliki JS."""
import http.server
import os

PORT = 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler).serve_forever()
