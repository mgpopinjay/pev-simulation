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

def shortestTrip(reqQueue, freeCars):
    shortestTrips = []
    for req in reqQueue:
        minCarIndex, minCar = min(enumerate(freeCars), key=lambda pair: util.dist(pair[1].pos, req.pickup))
        d = util.dist(minCar.pos, req.pickup)
        shortestTrips.append([d, minCarIndex])
    minReqIndex, minData = min(enumerate(shortestTrips), key=lambda lst: lst[0])
    return minReqIndex, minData[1]

def updateRequests2(freeCars, rebalancingCars, busyCars, simTime, requests, finishedTrips, idleTrips):
    interval = 30  # Delay in seconds
    if len(requests) == 0:
        return "No requests remaining"
    count = 0
    reqQueue = []
    req = requests[0]
    if req.time + interval <= simTime:  # Wait for [interval] second window
        if len(freeCars) > 0:  # Check for available cars
            # Get all requests within 5 second window, up to num of free cars
            # len(reqQueue) is always <= len(freeCars)
            while len(requests) > 0 and len(reqQueue) < len(freeCars):
                req = heapq.heappop(requests)
                if req.time <= simTime:  # Move request to queue
                    reqQueue.append(req)
                else:  # Put back into requests and end while loop
                    heapq.heappush(requests, req)
                    break
            while len(reqQueue) > 0:
                minReqIndex, minCarIndex = shortestTrip(reqQueue, freeCars)
                req = reqQueue.pop(minReqIndex)
                req.time = simTime
                req.pushtime = simTime - req.original_time
                minCar = freeCars.pop(minCarIndex)
                idl = minCar.end_idle(req)
                idleTrips.append(idl)
                util.assignFinishedTrip(finishedTrips, minCar, idl)
                heapq.heappush(busyCars, minCar)
                count += 1
            return "Assigned {} requests".format(count)
        else:
            return "Waiting for free cars to update requests"
    else:
        return "Waiting for {} seconds to update requests".format(round(req.time + interval - simTime, 1))


assignMethods = {"greedy": updateRequests, "interval": updateRequests2}
