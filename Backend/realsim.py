''' Fernando Sanchez, August 2017 '''
from . import sim_util as util
from .sim_assign import assignMethods as updateRequests
import heapq
import time
import random
# import datetime
import os
import json
import math

"""
NOTES FOR THE READER:

- Use the tuning variable to manipulate the simulator
- Many of these variables will be set via front end user input
- Turn off "PRINT_ANALYTICS" to avoid large terminal outputs
- TODO: Make the data sections below
- DISABLE_SPECIFICS is a list where every data variable listed by the user will not be printed in the output
- ENABLE_SPECIFICS is the same as disable but it enables the listed data variables
    - Don't overlap these two lists, you will get unexpected results
"""

"""
TODO LIST:
- randomizer for data
- hubway clusters
- make data buckets for presenting analytics in 'real time'
- comparison study using the UAP paper
- Speed up by preprocessing hubway data in exterior file
"""

def loadVariables():
    curpath = os.path.dirname(os.path.abspath(__file__))
    sim_id = json.load(open(os.path.dirname(curpath) + "/Backend/id_counter.txt"))
    filename = "sim_inputs_"+str(sim_id)+".json"
    with open("./id_counter.txt", 'w') as infile:
        infile.write(str(sim_id + 1))
    return json.load(open(os.path.dirname(curpath)+"/Backend/Inputs/"+filename))

def populateRequests(requests, mapName, randomRatio, taxiRatio, hubwayRatio, startHr, endHr, fuzzing, maxDist):
    if mapName == "Boston":
        if randomRatio:
            requests += util.generate_random_requests(["-71.05888", "42.360082"], 50, randomRatio, startHr, endHr, 3.2, fuzzing)
        if taxiRatio:
            requests += util.generate_taxi_trips(maxDist, 0, taxiRatio, startHr, endHr, fuzzing)
        if hubwayRatio:
            res = util.generate_hubway_trips(1000, maxDist, 0, hubwayRatio, startHr, endHr, fuzzing)
            requests += res[0]

    elif mapName == "Taipei":
        if randomRatio:
            requests += util.generate_random_requests(["121.538912", "25.044209"], 50, randomRatio, startHr, endHr, 5, fuzzing)
            requests += util.generate_random_requests(["121.484580", "25.019766"], 50, randomRatio / 2, startHr, endHr, 10, fuzzing)
            requests += util.generate_random_requests(["121.469703", "25.066972"], 50, randomRatio / 2, startHr, endHr, 8, fuzzing)

    heapq.heapify(requests)  # sort requests by start time
    return requests

def populatePEVs(numCars, totalCars, freeCars, busyCars, mapName):
    if mapName == "Boston":
        spawnPoints = [
            util.find_snap_coordinates(util.get_snap_output(["-71.093196", "42.358296"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.088376", "42.362249"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.085130", "42.362500"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.108264", "42.350325"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.097831", "42.344706"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.088076", "42.347284"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.086029", "42.344000"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.072874", "42.355593"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.070359", "42.352096"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.066270", "42.351172"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.062733", "42.352414"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.063130", "42.354835"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.100281", "42.363463"])),
        ]

    elif mapName == "Taipei":
        spawnPoints = [
            util.find_snap_coordinates(util.get_snap_output(["121.502746", "25.031213"])),
        ]

    for i in range(numCars):
        p = spawnPoints[i % len(spawnPoints)]
        car = util.PEV(i, p)
        freeCars.append(car)
        totalCars[i] = car

    heapq.heapify(busyCars)
    return freeCars


def runSim():
    print("running simulation...")
    variables = loadVariables()

    """
    TUNING VARIABLES
    """
    MAPSELECT   = variables["MapSelect"]
    NUMCARS     = variables["Fleet_Size"]  # number of vehicles
    CODE        = variables["Code"]  # RNG code
    RANDOM_DATA = variables["Random_Freq"]  # percentage of random trips to be generated
    HUBWAY_DATA = variables["Bike_Freq"]  # percentage of hubway data trips to be used
    TAXI_DATA   = variables["Taxi_Freq"] # percentage of taxi data
    MAX_DIST    = variables["Max_Dist"] * 1609.34
    SPAWN       = variables["Spawn_Point"]
    START_HR    = variables["Start_Hour"] # end hour of the simulation
    END_HR      = variables["End_Hour"] # start hour of the simulation

    print("Number of cars: " + str(NUMCARS))
    print("Code: " + str(CODE))

    NUMDATA = 1  # number of spreadsheets of data used
    KIND_RATIO = 70  # percent of trips that are passengers
    MADE_FILE = True  # make the visualizer JSON
    RANDOM_START = SPAWN
    CHARGING = False  # whether or not to use recharging model
    CHARGE_DISTANCE = MAX_DIST+util.max_stat_dist()
    CHARGE_RANGE = 15000.0
    CHARGE_TIME = 30
    REBALANCE_ON = False  # whether to rebalance
    K = 20  # number of clusters for rebalancing
    ALPHA = .1  # proportion of free cars that perform rebalancing
    PRINT_ANALYTICS = True  # whether to print final analytics
    DISABLE_SPECIFICS = []
    ENABLE_SPECIFICS = []
    FUZZING_ON = False
    SPAWN_POINT = []

    """
    THE SIMULATOR
    """
    simRunning = True
    requests = []
    finishedRequests = []
    rebalanceTrips = []  # ?
    idleTrips = []
    finishedTrips = {}
    totalCars = {}
    freeCars = []
    busyCars = []
    rebalancingCars = []
    assignType = "greedy"

    systemStartTime = time.time()
    print("Sim Start")
    simTime = START_HR * 3600  # Set simulator to start time in secs
    simEndTime = END_HR * 3600  # Time for simulator to end

    populateRequests(requests, MAPSELECT, RANDOM_DATA, TAXI_DATA, HUBWAY_DATA, START_HR, END_HR, FUZZING_ON, MAX_DIST)
    # initiateRebalance()
    populatePEVs(NUMCARS, totalCars, freeCars, busyCars, MAPSELECT)

    while simRunning:
        # updateRebalancingCars()
        util.updateBusyCars(busyCars, freeCars, simTime, finishedTrips, finishedRequests)
        updateRequests[assignType](freeCars, rebalancingCars, busyCars, simTime, requests, finishedTrips, idleTrips)
        # rebalanceCars()
        simTime += 1
        if simTime > simEndTime and len(requests) == 0 and len(busyCars) == 0:
            simRunning = False

    # while len(requests) > 0:
    #     # updateRebalancingCars()
    #     updateBusyCars(busyCars, freeCars, simTime, finishedTrips, finishedRequests)
    #     reqTime = requests[0].time
    #     if reqTime > simTime:
    #         simTime += 1
    #         continue
    #     assignRequest(freeCars, rebalancingCars, busyCars, simTime, requests, finishedTrips, idleTrips)
    #     # rebalanceCars()

    print("Sim Done")
    systemEndTime = time.time()
    systemDelta = systemEndTime - systemStartTime
    print("Sim Runtime: {}".format(systemDelta))
    print("Assignment Type: {}".format(assignType))
    print("Hubway Ratio: {}".format(HUBWAY_DATA))
    print("Taxi Ratio: {}".format(TAXI_DATA))
    print("Random Ratio: {}".format(RANDOM_DATA))

    """
    Create results JSON
    """
    carData = util.getCarData(totalCars, finishedTrips)
    simInputs = {
        "MAPSELECT": MAPSELECT,
        "NUMCARS": NUMCARS,
        "MAX_DIST": MAX_DIST,
        "KIND_RATIO": KIND_RATIO,
        "RANDOM_START": RANDOM_START,
        "SPAWN_POINT": SPAWN_POINT,
        "REBALANCE_ON": REBALANCE_ON,
        "TAXI_DATA": TAXI_DATA,
        "BIKE_DATA": HUBWAY_DATA,
        "RANDOM_DATA": RANDOM_DATA,
        "START_HR": START_HR,
        "END_HR": END_HR
    }
    simOutputs = util.analyzeResults(finishedRequests, freeCars, systemDelta, START_HR, END_HR)

    finalData = {}
    finalData["fleet"] = carData
    finalData["inputs"] = simInputs
    finalData["outputs"] = simOutputs

    if MADE_FILE:
        filename = "sim_results_"+str(CODE)+".JSON"
        util.send_to_visualizer(finalData, filename)
        print("Made file")
    print("DONE")
    return finalData


if __name__ == '__main__':
    runSim()
