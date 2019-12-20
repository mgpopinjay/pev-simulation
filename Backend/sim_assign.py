import heapq
from . import sim_util as util
import logging
import random
logging.basicConfig(level=logging.INFO, format='%(%(levelname)s - %(message)s')

def assignRequest(simTime, timeStep, cars, requests, logs):
    '''
    Current implementation to assign requests
    Picks the nearest car for each request
    Will be superceded by a smarter algorithm
    '''
    for car in cars['rebalancingCars']:  # Update position of rebalancing cars before calculating min distance
        car.updateLocation(simTime)
    tempFreeCars = len(cars['rebalancingCars']) + len(cars['freeCars'])
    req = heapq.heappop(requests)
    minCar, minCarIndexF, minCarF, minCarIndexR, minCarR = (None, None, None, None, None)
    if tempFreeCars > 0:
        '''
        Loop through free and rebalancing cars to find the car closest to the pickup location
        Fix this overcomplicated code by using remove instead of del
        However remove causes issues where cars are in the wrong states and/or lists
        '''
        ncars_consider = 1

        if len(cars['freeCars']) > 0:
            minCarLs = sorted(list(enumerate(cars['freeCars'])), key=lambda pair: util.dist(pair[1].pos, req.pickup))[:ncars_consider]
            minCarIndexF, minCarF = random.choice(minCarLs)
        if len(cars['rebalancingCars']) > 0:
            minCarLs = sorted(list(enumerate(cars['rebalancingCars'])), key=lambda pair: util.dist(pair[1].pos, req.pickup))[:ncars_consider]
            minCarIndexR, minCarR = random.choice(minCarLs)

        considered = []
        if minCarIndexF is not None:
            considered.append((minCarIndexF, minCarF))
        if minCarIndexR is not None:
            considered.append((minCarIndexR, minCarR))
        if considered:

        if minCarIndexF is not None and minCarIndexR is not None:
            if util.dist(minCarF.pos, req.pickup) <= util.dist(minCarR.pos, req.pickup):
                minCar = minCarF
                del cars['freeCars'][minCarIndexF]
            else:
                minCar = minCarR
                del cars['rebalancingCars'][minCarIndexR]
        elif minCarIndexF is not None:
            minCar = minCarF
            del cars['freeCars'][minCarIndexF]
        elif minCarIndexR is not None:
            minCar = minCarR
            del cars['rebalancingCars'][minCarIndexR]
        else:
            logging.warning("minCar is None!")

        prevState = minCar.state
        resp = minCar.update(simTime, logs['finishedTrips'], req=req)
        logging.info(f"Car {str(minCar.id).zfill(4)}: {prevState} -> {resp}")
        heapq.heappush(cars['navCars'], minCar)  # move car to busy list
        return "Assigned request to car: {}".format(minCar.id)

    else:  # If there are no available cars
        if req.assigntime >= 5*60:  # Drop request if older than 12 mins
            logs['droppedRequests'].append(req)
            return "Dropped request"
        else:  # Push back their request time by a second/specified time step
            req.assigntime += timeStep
            req.time += timeStep
            heapq.heappush(requests, req)
            return "Pushed back request"

def updateRequests(simTime, timeStep, cars, requests, logs):
    '''
    Wrapper function for assignRequest
    '''
    count = 0
    while len(requests) > 0:
        req = requests[0]
        if req.time <= simTime:
            assignRequest(simTime, timeStep, cars, requests, logs)
            count += 1
        else:
            break
    return "Assigned {} requests".format(count)


assignMethods = {"closestCar": updateRequests}
