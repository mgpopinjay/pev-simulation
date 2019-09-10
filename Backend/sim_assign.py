import heapq
from . import sim_util as util
import logging
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
        if len(cars['freeCars']) > 0:
            minCarIndexF, minCarF = min(enumerate(cars['freeCars']), key=lambda pair: util.dist(pair[1].pos, req.pickup))
        if len(cars['rebalancingCars']) > 0:
            minCarIndexR, minCarR = min(enumerate(cars['rebalancingCars']), key=lambda pair: util.dist(pair[1].pos, req.pickup))
        if minCarIndexF and minCarIndexR:
            if util.dist(minCarF.pos, req.pickup) <= util.dist(minCarR.pos, req.pickup):
                minCar = minCarF
                del cars['freeCars'][minCarIndexF]
            else:
                minCar = minCarR
                del cars['rebalancingCars'][minCarIndexR]
        elif minCarIndexF:
            minCar = minCarF
            del cars['freeCars'][minCarIndexF]
        elif minCarIndexR:
            minCar = minCarR
            del cars['rebalancingCars'][minCarIndexR]
        prevState = minCar.state
        resp = minCar.update(simTime, logs['finishedTrips'], req=req)
        logging.info(f"Car {str(minCar.id).zfill(4)}: {prevState} -> {resp}")
        heapq.heappush(cars['navCars'], minCar)  # move car to busy list
        return "Assigned request to car: {}".format(minCar.id)

    else:  # If there are no available cars, push back their request time by a second/specified time step
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
