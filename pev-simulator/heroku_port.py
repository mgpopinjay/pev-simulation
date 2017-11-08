from os import environ
from flask import Flask
from sim_serv import ServerHandler
import SimpleHTTPServer
import SocketServer
import logging
import json
from server.run_sim import Run
from server import routes, dynamic_trips
import sys
import simplejson

app = Flask(__name__)


@app.route('/')
def index():
    return ""

if __name__ == '__main__':
    app.debug = True
    port = int(environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)


    # sim serv
    # initialize simulation requirements
    routes.RouteFinder("server/google_api_key", "routes_cache")
    dynamic_trips.TripRandomizer().loadLocsFile(".loc_file")
    dynamic_trips.TripRandomizer().loadRidesFile(".rides_def")
    Handler = ServerHandler
    httpd = SocketServer.TCPServer(("", port), Handler)
    httpd.serve_forever()
