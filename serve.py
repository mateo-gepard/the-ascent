#!/usr/bin/env python3
"""Static server with HTTP Range (206) support — required for video scrubbing/seeking."""
import http.server, os, re, socketserver, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8777

class RangeHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().send_head()
        rng = self.headers.get("Range")
        if not rng:
            return super().send_head()
        m = re.match(r"bytes=(\d*)-(\d*)", rng)
        if not m:
            return super().send_head()
        size = os.path.getsize(path)
        start = int(m.group(1)) if m.group(1) else 0
        end = int(m.group(2)) if m.group(2) else size - 1
        end = min(end, size - 1)
        if start > end:
            self.send_error(416); return None
        length = end - start + 1
        ctype = self.guess_type(path)
        f = open(path, "rb"); f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(length))
        self.end_headers()
        # stream just the requested slice
        remaining = length
        while remaining > 0:
            chunk = f.read(min(64 * 1024, remaining))
            if not chunk: break
            try: self.wfile.write(chunk)
            except (BrokenPipeError, ConnectionResetError): break
            remaining -= len(chunk)
        f.close()
        return None

class Threaded(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

Threaded(("", PORT), RangeHandler).serve_forever()
