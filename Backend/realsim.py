''' Fernando Sanchez, August 2017 '''
from . import sim_util as util
from .sim_assign import assignMethods as updateRequests
import heapq
import time
# import datetime
import os
import json
import numpy as np
import logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')

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

chargingStations = [[-71.0655, 42.3550], [-71.0856, 42.3625], [-71.0551, 42.3519], [-71.0903, 42.3397]]

def loadVariables():
    '''
    Load the simulation variables from file
    '''
    curpath = os.path.dirname(os.path.abspath(__file__))
    sim_id = json.load(open(os.path.dirname(curpath) + "/Backend/id_counter.txt"))
    filename = "sim_inputs_"+str(sim_id)+".json"
    with open("./id_counter.txt", 'w') as infile:
        infile.write(str(sim_id + 1))
    return json.load(open(os.path.dirname(curpath)+"/Backend/Inputs/"+filename))

def populateRequests(requests, mapName, randomRatio, taxiRatio, bikeRatio, trainRatio, startHr, endHr, fuzzing, maxDist):
    '''
    Populate request list by sampling datasets
    '''
    logging.warning("Populating requests")
    if mapName == "Boston":
        if randomRatio:
            requests += util.generate_random_requests(["-71.05888", "42.360082"], 50, randomRatio, startHr, endHr, 3.2, True)
        if taxiRatio:
            requests += util.generate_taxi_trips(maxDist, 0, taxiRatio, startHr, endHr, fuzzing)
        if bikeRatio:
            res = util.generate_hubway_trips(maxDist, 0, bikeRatio, startHr, endHr, fuzzing)
            requests += res[0]
        if trainRatio:
            requests += util.generate_train_requests(maxDist, trainRatio, startHr, endHr, True)

    elif mapName == "Taipei":
        if randomRatio:
            requests += util.generate_random_requests(["121.538912", "25.044209"], 50, randomRatio, startHr, endHr, 5, True)
            requests += util.generate_random_requests(["121.484580", "25.019766"], 50, randomRatio / 2, startHr, endHr, 10, True)
            requests += util.generate_random_requests(["121.469703", "25.066972"], 50, randomRatio / 2, startHr, endHr, 8, True)
        if bikeRatio:
            requests += util.generate_youbike_trips(maxDist, 0, bikeRatio, startHr, endHr, fuzzing)

    heapq.heapify(requests)  # sort requests by start time
    return requests

def map2PEVCoords(mapName):
    '''
    Take city name as input and returns a list of spawn point coordinates
    Temporary solution until coordinate selection is implemented in frontend
    Weights will be used to place more cars at popular hubs
    '''
    if mapName == "Boston":
        coords = [
            [-71.093196, 42.358296],
            [-71.088376, 42.362249],
            [-71.085130, 42.362500],
            [-71.108264, 42.350325],
            [-71.097831, 42.344706],
            [-71.088076, 42.347284],
            [-71.086029, 42.344000],
            [-71.072874, 42.355593],
            [-71.070359, 42.352096],
            [-71.066270, 42.351172],
            [-71.062733, 42.352414],
            [-71.063130, 42.354835],
            [-71.100281, 42.363463],
        ]
        weights = []

    elif mapName == "Taipei":
        coords = [
            [121.502746, 25.031213]
        ]
        weights = []

    return coords, weights


def populatePEVs(numCars, totalCars, freeCars, coords, weights):
    '''
    Populate list of free cars with PEVs at each spawn point
    '''
    logging.warning("Populating PEVs")
    spawnPoints = []
    for s in coords:
        spawnPoints.append(util.find_snap_coordinates(util.get_snap_output(s)))
    for i in range(numCars):
        p = spawnPoints[i % len(spawnPoints)]  # Picks spawn points for cars in a round robin order, in future will consider weights
        car = util.PEV(i, p)
        freeCars.append(car)
        totalCars[i] = car

    return freeCars


def rebalancePEVs(simTime, cars, finishedTrips):
    '''
    Pick cars from free cars to rebalance to a new location
    Currently picks randomly and has a random location
    Will be replaced with a smarter rebalancing algorithm
    '''
    updatedCars = []
    while len(cars['freeCars']) > 0 and len(cars['rebalancingCars']) < 10:
        car = cars['freeCars'].pop(0)
        start_point = car.pos
        endpos = util.gaussian_randomizer(start_point, 2, True)  # Pick random location to rebalance to, will be changed
        end_point = util.find_snap_coordinates(util.get_snap_output(endpos))
        req = util.Rebalance(simTime, start_point, end_point)
        car.update(simTime, finishedTrips, req=req)  # Change PEV state to REBALANCE
        heapq.heappush(cars['rebalancingCars'], car)
        updatedCars.append(str(car.id))
    if len(updatedCars) > 0:
        return f"Updated the following cars: {updatedCars}."
    else:
        return "No cars to update."


def runSim():
    logging.warning("Running simulation...")
    variables = loadVariables()

    """
    TUNING VARIABLES
    """
    MAPSELECT   = variables["MapSelect"]
    NUMCARS     = variables["Fleet_Size"]   # number of vehicles
    CODE        = variables["Code"]         # RNG code
    RANDOM_DATA = variables["Random_Freq"]  # percentage of random trips to be generated
    BIKE_DATA   = variables["Bike_Freq"]    # percentage of hubway data trips to be used
    TAXI_DATA   = variables["Taxi_Freq"]    # percentage of taxi data
    TRAIN_DATA  = variables["Train_Freq"]   # percentage of train data
    MAX_DIST    = variables["Max_Dist"] * 1609.34
    SPAWN       = variables["Spawn_Point"]
    START_HR    = variables["Start_Hour"]   # end hour of the simulation
    END_HR      = variables["End_Hour"]     # start hour of the simulation

    logging.warning("Number of cars: " + str(NUMCARS))
    logging.warning("Code: " + str(CODE))

    TIMESTEP = 1  # seconds per time step
    KIND_RATIO = 70  # percent of trips that are passengers
    MADE_FILE = True  # make the visualizer JSON
    RANDOM_START = SPAWN
    CHARGING_ON = True  # whether or not to use recharging model
    CHARGE_DISTANCE = MAX_DIST+util.max_stat_dist()
    CHARGE_RANGE = 15000.0
    CHARGE_TIME = 30
    CHARGE_LIMIT = 5
    REBALANCE_ON = False  # whether to rebalance
    K = 20  # number of clusters for rebalancing
    ALPHA = .1  # proportion of free cars that perform rebalancing
    FUZZING_ON = False  # used to spread out job spawns
    FIXED_RANDOM_SEED = True
    SPAWN_POINT = []

    """
    THE SIMULATOR
    """
    simRunning = True
    requests = []
    finishedRequests = []
    finishedTrips = {}
    totalCars = {}
    cars = {
        'freeCars': [],
        'navCars': [],
        'waitCars': [],
        'busyCars': [],
        'rebalancingCars': [],
        'navToChargeCars': [],
        'chargingCars': []
    }
    assignType = "closestCar"

    centers = [[121.54140119, 25.05149155],
               [121.52009872, 25.06688664],
               [121.56683844, 25.03978176],
               [121.53784721, 25.02401502],
               [121.49422853, 25.13004852],
               [121.51153670, 25.03671236],
               [121.56898900, 25.07818477],
               [121.60457594, 25.05676364],
               [121.55205896, 24.99518549],
               [121.52341230, 25.10561830]]
    weights = [0.150798853923853920, 0.086375777000777000,
               0.234886363636363640, 0.194824689199689200,
               0.026354895104895106, 0.119346833721833720,
               0.051842948717948720, 0.042272727272727274,
               0.025182595182595184, 0.068114316239316240]
    RData = util.RebalanceData(centers, weights)

    systemStartTime = time.time()
    logging.warning("Sim Start")
    simTime = START_HR * 3600  # Set simulator time to start time in secs
    simEndTime = END_HR * 3600

    populateRequests(requests, MAPSELECT, RANDOM_DATA, TAXI_DATA, BIKE_DATA, TRAIN_DATA, START_HR, END_HR, FUZZING_ON, MAX_DIST)
    # initiateRebalance()
    c, w = map2PEVCoords(MAPSELECT)  # Temporary solution for spawn point input
    populatePEVs(NUMCARS, totalCars, cars['freeCars'], c, w)

    while simRunning:
        # updateRebalancingCars()
        util.updateBusyCars(simTime, cars, {'finishedTrips': finishedTrips, 'finishedRequests': finishedRequests}, CHARGING_ON, CHARGE_LIMIT)
        updateRequests[assignType](simTime, TIMESTEP, cars, requests, {'finishedTrips': finishedTrips})
        if len(requests) > 0:
            rebalancePEVs(simTime, cars, finishedTrips)
        simTime += TIMESTEP
        if simTime > simEndTime and len(requests) == 0 and len(cars['busyCars']) == 0 and len(cars['waitCars']) == 0 and len(cars['navCars']) == 0:
            simRunning = False

    logging.warning("Sim Done")
    systemEndTime = time.time()
    systemDelta = systemEndTime - systemStartTime
    logging.warning("Sim Runtime: {}".format(systemDelta))
    logging.warning("Assignment Type: {}".format(assignType))
    logging.warning("Bike Ratio: {}".format(BIKE_DATA))
    logging.warning("Taxi Ratio: {}".format(TAXI_DATA))
    logging.warning("Train Ratio: {}".format(TRAIN_DATA))
    logging.warning("Random Ratio: {}".format(RANDOM_DATA))

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
        "TRAIN_DATA": TRAIN_DATA,
        "BIKE_DATA": BIKE_DATA,
        "RANDOM_DATA": RANDOM_DATA,
        "START_HR": START_HR,
        "END_HR": END_HR
    }
    simOutputs = util.analyzeResults(finishedRequests, cars['freeCars'], systemDelta, START_HR, END_HR)

    finalData = {}
    finalData["fleet"] = carData
    finalData["inputs"] = simInputs
    finalData["outputs"] = simOutputs

    if MADE_FILE:
        filename = "sim_results_"+str(CODE)+".JSON"
        util.send_to_visualizer(finalData, filename)
        logging.warning("Made file")
    logging.warning("DONE")
    return finalData


if __name__ == '__main__':
    runSim()
