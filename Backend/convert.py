import json
import os

filename = "sim_results_3546.JSON"

curpath = os.path.dirname(os.path.abspath(__file__))
new_path = curpath+"/Results/"+filename
with open(new_path, 'r') as results:
    data = json.load(results)

polyline = data["fleet"]["0"]["history"][1]
print(polyline)

with open("polyline.json", 'w') as trip:
    json.dump(polyline, trip)