import numpy as np
import matplotlib.pyplot as plt
import requests
import json

def gaussian_randomizer(location, distance):
    cov = [[distance, 0], [0, distance]]
    loc1 = location[0].strip('\"')
    loc2 = location[1].strip('\"')
    loc = [float(loc1), float(loc2)]
    point = np.random.multivariate_normal(loc, cov)
    pointo = [str(point[0]), str(point[1])]
    return pointo

def test_distance(location, distance, trials):
    loc1 = location[0].strip('\"')
    loc2 = location[0].strip('\"')
    loc = [float(loc1), float(loc2)]
    counter = 0
    rollsum = 0
    maxdist = 0
    for i in range(trials):
        print(i)
        pointo = gaussian_randomizer(location, distance)
        point1 = [float(pointo[0]), float(pointo[1])]
        delta = ((point1[0]-loc[0])**2 + (point1[1]-loc[1])**2)**0.5
        if delta > maxdist:
            maxdist = delta
        rollsum += delta
        counter += 1
    # print("{} runs.".format(counter))
    return (rollsum / counter * 111.111, maxdist * 111.111)


# testx = [0.000001, 0.000002, 0.000005, 0.00001, 0.00002, 0.00005, 0.000075, 0.0001, 0.0002, 0.0003, 0.0004, 0.0005, 0.0006, 0.0007, 0.0008, 0.0009, 0.001]
# testy = []
# testy2 = [0.13975304857476734, 0.19847902627664848, 0.3109029006335079, 0.43963388854653634, 0.6265234934535241, 0.9853388703926014, 1.3972248957175812, 1.9725738566226982, 3.109920386790102, 4.393727101505195, 6.166841499764403, 9.827124340835015, 14.07842368984459]
# testz = []

# for x in testx:
#     tup = test_distance(["0.0000", "0.0000"], x, 100000)
#     testy.append(tup[0])
#     testz.append(tup[1])
# testz.append(0)
# testx.append(0)
# testy.append(0)
# print(testy)
# for i in range(len(testx)):
#     print("Input: {}, Output: {} km / {} mi, Max: {} km".format(testx[i], round(testy[i], 2), round(testy[i]*0.62137, 2), round(testz[i], 6)))

# pfit = np.polyfit(testz, testx, 2)
# print(pfit)




# #fit_np=?
# #print(fit_np)

# plt.plot(testz, testx, "bo")
# ##UNCOMENT LINE BELOW TO SEE YOUR FIT ON TOP OF ORIGINAL DATA
# plt.plot(testz, np.polyval(pfit, testz), "r--", lw = 2)
# plt.show()

polydata = [
    [4.79228962e-06, -9.07140780e-06,  1.33846577e-05],
    [5.69955193e-06, -1.43113143e-05,  1.82065198e-05],
    [5.26073468e-06, -1.43448673e-05,  2.26175831e-05],
    [2.48862463e-06,  2.21031370e-05, -3.51382214e-05],
    [3.26289841e-06,  1.09862407e-05, -1.86767497e-05],
    [3.20064084e-06,  1.17194262e-05, -2.04968974e-05],
    [3.54309099e-06,  8.70364177e-06, -1.58211085e-05],
    [2.62088524e-06,  1.79423650e-05, -2.75186226e-05]
]


# for i in range(3):
#     rollsum = 0
#     for j in range(8):
#         rollsum += polydata[j][i]
#     print(rollsum)
#     print(rollsum / 8)

# d = 0.5
# c = 3.17681940e-06*d*d + 1.95948301e-06*d - 3.74111216e-06
# print(c)


url = "http://data.taipei/youbike"
data = requests.get(url).json()

for key, value in data["retVal"].items():
  sno = value["sno"]
  sna = value["sna"]
  print("NO.", sno, sna)
