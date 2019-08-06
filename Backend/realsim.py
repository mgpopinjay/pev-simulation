''' Fernando Sanchez, August 2017 '''
from . import sim_util as util
from .sim_assign import assignMethods as updateRequests
import heapq
import time
# import datetime
import os
import json
import numpy as np

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

def populateRequests(requests, mapName, randomRatio, taxiRatio, bikeRatio, startHr, endHr, fuzzing, maxDist):
    if mapName == "Boston":
        if randomRatio:
            requests += util.generate_random_requests(["-71.05888", "42.360082"], 50, randomRatio, startHr, endHr, 3.2, True)
        if taxiRatio:
            requests += util.generate_taxi_trips(maxDist, 0, taxiRatio, startHr, endHr, fuzzing)
        if bikeRatio:
            res = util.generate_hubway_trips(maxDist, 0, bikeRatio, startHr, endHr, fuzzing)
            requests += res[0]

    elif mapName == "Taipei":
        if randomRatio:
            requests += util.generate_random_requests(["121.538912", "25.044209"], 50, randomRatio, startHr, endHr, 5, True)
            requests += util.generate_random_requests(["121.484580", "25.019766"], 50, randomRatio / 2, startHr, endHr, 10, True)
            requests += util.generate_random_requests(["121.469703", "25.066972"], 50, randomRatio / 2, startHr, endHr, 8, True)
        if bikeRatio:
            requests += util.generate_youbike_trips(maxDist, 0, bikeRatio, startHr, endHr, fuzzing)

    heapq.heapify(requests)  # sort requests by start time
    return requests

def populatePEVs(numCars, totalCars, freeCars, mapName):
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
        weights = []

    elif mapName == "Taipei":
        spawnPoints = [
            util.find_snap_coordinates(util.get_snap_output(["121.502746", "25.031213"])),
        ]
        weights = []

    for i in range(numCars):
        p = spawnPoints[i % len(spawnPoints)]
        car = util.PEV(i, p)
        freeCars.append(car)
        totalCars[i] = car

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
    BIKE_DATA = variables["Bike_Freq"]  # percentage of hubway data trips to be used
    TAXI_DATA   = variables["Taxi_Freq"] # percentage of taxi data
    MAX_DIST    = variables["Max_Dist"] * 1609.34
    SPAWN       = variables["Spawn_Point"]
    START_HR    = variables["Start_Hour"] # end hour of the simulation
    END_HR      = variables["End_Hour"] # start hour of the simulation

    print("Number of cars: " + str(NUMCARS))
    print("Code: " + str(CODE))

    TIMESTEP = 1  # seconds per time step
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
    FUZZING_ON = False  # used to spread out job spawns
    FIXED_RANDOM_SEED = True
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
    navCars = []
    waitCars = []
    busyCars = []
    rebalancingCars = []
    assignType = "closestCar"

    centers = [[121.54140119, 25.05149155],
                [121.52009872, 25.06688664],
                [121.56683844, 25.03978176],
                [121.53784721, 25.02401502],
                [121.49422853, 25.13004852],
                [121.5115367, 25.03671236],
                [121.568989, 25.07818477],
                [121.60457594, 25.05676364],
                [121.55205896, 24.99518549],
                [121.5234123, 25.1056183]]
    weights = [0.15079885392385392, 0.086375777000777,
                0.23488636363636364, 0.1948246891996892,
                0.026354895104895106, 0.11934683372183372,
                0.05184294871794872, 0.042272727272727274,
                0.025182595182595184, 0.06811431623931624]
    RData = util.RebalanceData(centers, weights)

    systemStartTime = time.time()
    print("Sim Start")
    simTime = START_HR * 3600  # Set simulator to start time in secs
    simEndTime = END_HR * 3600  # Time for simulator to end

    populateRequests(requests, MAPSELECT, RANDOM_DATA, TAXI_DATA, BIKE_DATA, START_HR, END_HR, FUZZING_ON, MAX_DIST)
    # initiateRebalance()
    populatePEVs(NUMCARS, totalCars, freeCars, MAPSELECT)

    while simRunning:
        # updateRebalancingCars()
        util.updateBusyCars(waitCars, navCars, busyCars, freeCars, simTime, finishedTrips, finishedRequests)
        updateRequests[assignType](freeCars, rebalancingCars, navCars, busyCars, simTime, TIMESTEP, requests, finishedTrips, idleTrips)
        # rebalanceCars()
        simTime += TIMESTEP
        if simTime > simEndTime and len(requests) == 0 and len(busyCars) == 0 and len(waitCars) == 0 and len(navCars) == 0:
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
    print("Bike Ratio: {}".format(BIKE_DATA))
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
        "BIKE_DATA": BIKE_DATA,
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
