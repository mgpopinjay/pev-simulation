import heapq
from . import sim_util as util

def assignRequest(freeCars, rebalancingCars, busyCars, simTime, requests, finishedTrips, idleTrips):
    tempFreeCars = rebalancingCars + freeCars
    req = heapq.heappop(requests)

    if len(tempFreeCars) > 0:
        # loop through free_cars to find the car with minimum linear distance to pickup
        minCarIndex, minCar = min(enumerate(freeCars), key=lambda pair: util.dist(pair[1].pos, req.pickup))
        del freeCars[minCarIndex]
        idl = minCar.end_idle(req)
        idleTrips.append(idl)
        util.assignFinishedTrip(finishedTrips, minCar, idl)
        heapq.heappush(busyCars, minCar)  # move car to busy list
        return "Assigned request to car: {}".format(minCar.id)

    else:  # there are no free cars
        # Try implementing system where pushed back requests are not equal
        req.pushtime += 1.0  # increment time by 1 second
        req.time += 1.0  # move the request time forward until a car is free to claim it
        heapq.heappush(requests, req)
        return "Pushed back request"

def updateRequests(freeCars, rebalancingCars, busyCars, simTime, requests, finishedTrips, idleTrips):
    count = 0
    while len(requests) > 0:
        req = requests[0]
        if req.time <= simTime:
            assignRequest(freeCars, rebalancingCars, busyCars, simTime, requests, finishedTrips, idleTrips)
            count += 1
        else:
            break
    return "Assigned {} requests".format(count)
