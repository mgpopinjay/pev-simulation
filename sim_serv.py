#!/usr/bin/env python

# server code courtesy of https://snipt.net/raw/f8ef141069c3e7ac7e0134c6b58c25bf/?nice
# @rochacbruno

import SimpleHTTPServer
import SocketServer
import logging
import json
from server.run_sim import Run
#from server import routes, dynamic_trips
import sys
import simplejson
import datetime
import os
import subprocess

PORT = 8235


class ServerHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):

    """ Local Python Server to run the simulation"""

    def do_GET(self):
        logging.warning("======= GET STARTED =======")
        logging.warning(self.headers)
        SimpleHTTPServer.SimpleHTTPRequestHandler.do_GET(self)

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With")

    def do_POST(self):
        logging.warning("======= POST STARTED =======")
        logging.warning(" PATH: " + self.path)
        logging.warning(self.headers)
        logging.warning("======= POST VALUES =======")
        length = int(self.headers['Content-Length'])
        data = self.rfile.read(length)
        logging.warning("Received: " + data)
        args = json.loads(data)
        fleet_size = int(args["size"])
        dist = args["maxDist"]
        code = args["code"]
        maxDist = int(dist)
        parcFreq = int(args["parcels"])
        #   File Save Function!
        '''
        MEGAUPDATE
        '''
        # create dictionary of data to dump as JSON to 'Variable_X.json file'
        data_to_send = {}
        data_to_send["Rebalancing_Vehicles"] = parcFreq
        data_to_send["Fleet_Size"] = fleet_size
        data_to_send["Code"] = code
        # read id_counter.txt to know which simulation we are on
        content = []
        with open("id_counter.txt", 'r') as infile:
            content = infile.readlines()
        # print "OG: "+str(content)
        c = str(content[0])
        # print "Edited: "+c
        filename = "Variable_"+c+".json"
        # find path to Variables folder to write to
        curpath = os.path.dirname(os.path.abspath(__file__))
        # print curpath
        new_path = curpath+"/Variables/"+filename
        print new_path
        outfile = open(new_path, 'w')
        json.dump(data_to_send, outfile)
        outfile.close()
        # call backend to run simulation now that Variables is updated
        temp_path = curpath+"/Backend/realsim.py"
        subprocess.call(['python', temp_path])
        '''
        END MEGAUPDATE
        '''
        #f.writelines("Rebalancing Vehicles: " + str(parcFreq) + "\n")
        #f.writelines("Fleet Size: " + str(fleet_size) + "\n")
        #f.writelines("Modal Transfer from Public Transit: " + str(maxDist))
        #   File Save Function End!
        logging.warning("\n")
        if self.path == "/fleetsim":
            args = json.loads(data)
            fleet_size = int(args["size"])
            # (dist, units) = args["maxDist"].split()
            maxDist = int(dist) * 1600
            # parcFreq = int(args["parcels"].split()[0])
            pacFreq = 10
            # sim_uid = args["sim_uid"]
            sim_uid = 899
            sim_duration = 28800  # 8 hours

            logging.warning("======= File Test =======")
            # this finds live data
            response = Run(sim_uid, fleet_size, maxDist, parcFreq, sim_duration)
            self.send_response(200, "OK")
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header("Content-type", "json")
            self.end_headers()
            with open("server/response.json", "w+") as outfile:
                # print 'writing to new file'
                json.dump(response, outfile)
            f = open("server/response.json", "r")
            self.wfile.write(f.read())
        else:
            SimpleHTTPServer.SimpleHTTPRequestHandler.do_GET(self)
        return ServerHandler

# initialize simulation requirements
#routes.RouteFinder("server/google_api_key", "routes_cache")
# dynamic_trips.TripRandomizer().loadLocsFile(".loc_file")
# dynamic_trips.TripRandomizer().loadRidesFile(".rides_def")
Handler = ServerHandler
httpd = SocketServer.TCPServer(("", PORT), Handler)
httpd.serve_forever()
