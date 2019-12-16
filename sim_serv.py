#!/usr/bin/env python

# server code courtesy of https://snipt.net/raw/f8ef141069c3e7ac7e0134c6b58c25bf/?nice
# @rochacbruno

# import SimpleHTTPServer
import http.server
# import SocketServer
import socketserver
import logging
import json
from Backend.realsim import runSim
# from server import routes, dynamic_trips
# import sys
# import simplejson
# import datetime
import os
# import subprocess

PORT = 9000


class ServerHandler(http.server.SimpleHTTPRequestHandler):

    """ Local Python Server to run the simulation"""

    def do_GET(self):
        logging.debug("======= GET STARTED =======")
        logging.debug(self.headers)
        http.server.SimpleHTTPRequestHandler.do_GET(self)

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

        if self.path == "/fleetsim":
            data = self.rfile.read(length)
            logging.warning("Received: " + str(data))
            args = json.loads(data.decode('utf-8'))
            fleet_size = int(args["size"])
            code = args["code"]
            stations = int(args["stations"])
            jobDrop = int(args["job_drop"])
            maxDist = int(args["max_dist"])
            battery = int(args["battery"])
            parcFreq = int(args["parcels"])
            randomFreq = int(args["random"])
            bikeFreq = int(args["bike"])
            taxiFreq = int(args["taxi"])
            trainFreq = int(args["train"])
            fuzzing = int(args["fuzzing"])
            rebalance_toggle = int(args["rebalance_toggle"])
            startHrs = int(args["starthrs"])
            endHrs = int(args["endhrs"])
            mapSelect = args["mapselect"]

            # create dictionary of data to dump as JSON to 'Variable_X.json file'
            data_to_send = {
                "MapSelect": mapSelect,
                "Rebalancing_Vehicles": parcFreq,
                "Fleet_Size": fleet_size,
                "Job_Drop": jobDrop,
                "Stations": stations,
                "Job_Drop": jobDrop,
                "Bike_Freq": bikeFreq,
                "Random_Freq": randomFreq,
                "Taxi_Freq": taxiFreq,
                "Train_Freq": trainFreq,
                "Fuzz_Toggle": fuzzing,
                "Rebalance_Toggle": rebalance_toggle,
                "Max_Dist": maxDist,
                "Battery": battery,
                "Spawn_Point": 0,
                "Start_Hour": startHrs,
                "End_Hour": endHrs,
                "Code": code
            }
            # read id_counter.txt to know which simulation we are on
            sim_id = json.load(open("Backend/id_counter.txt"))
            filename = "sim_inputs_"+str(sim_id)+".json"

            # find path to Variables folder to write to
            curpath = os.path.dirname(os.path.abspath(__file__))
            new_path = curpath+"/Backend/Inputs/"+filename
            with open(new_path, 'w') as outfile:
                json.dump(data_to_send, outfile)

            # call backend to run simulation now that Variables is updated
            # temp_path = curpath+"/realsim.py"
            # subprocess.call(['python', temp_path])

            resp = runSim()
            self.send_response(200, "OK")
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header("Content-type", "json")
            self.end_headers()
            self.wfile.write(json.dumps(resp).encode("utf-8"))
        else:
            testdata = json.load(open("test.JSON"))
            self.send_response(200, "OK")
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header("Content-type", "json")
            self.end_headers()
            self.wfile.write(json.dumps(str(testdata)))
        return
        # f.writelines("Rebalancing Vehicles: " + str(parcFreq) + "\n")
        # f.writelines("Fleet Size: " + str(fleet_size) + "\n")
        # f.writelines("Modal Transfer from Public Transit: " + str(maxDist))
        # File Save Function End!
        # logging.warning("\n")
        # if self.path == "/fleetsim":
        #     args = json.loads(data)
        #     fleet_size = int(args["size"])
        #     # (dist, units) = args["maxDist"].split()
        #     maxDist = int(dist) * 1600
        #     # parcFreq = int(args["parcels"].split()[0])
        #     pacFreq = 10
        #     # sim_uid = args["sim_uid"]
        #     sim_uid = 899
        #     sim_duration = 28800  # 8 hours

        #     logging.warning("======= File Test =======")
        #     # this finds live data
        #     # response = Run(sim_uid, fleet_size, maxDist, parcFreq, sim_duration)
        #     # response = run_sim(fleet_size, sim_uid)
        #     self.send_response(200, "OK")
        #     self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        #     self.send_header('Access-Control-Allow-Origin', '*')
        #     self.send_header("Content-type", "json")
        #     self.end_headers()
        #     with open("server/response.json", "w+") as outfile:
        #         # print 'writing to new file'
        #         json.dump(response, outfile)
        #     f = open("server/response.json", "r")
        #     self.wfile.write(f.read())
        # else:
        #     SimpleHTTPServer.SimpleHTTPRequestHandler.do_GET(self)
        # return ServerHandler

# initialize simulation requirements
# routes.RouteFinder("server/google_api_key", "routes_cache")
# dynamic_trips.TripRandomizer().loadLocsFile(".loc_file")
# dynamic_trips.TripRandomizer().loadRidesFile(".rides_def")
Handler = ServerHandler
httpd = socketserver.TCPServer(("", PORT), Handler)
httpd.serve_forever()
