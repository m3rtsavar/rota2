from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class RotaRequestHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".webmanifest": "application/manifest+json",
    }


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 5500), RotaRequestHandler)
    print("Rota: http://127.0.0.1:5500")
    server.serve_forever()
