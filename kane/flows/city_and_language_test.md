---
mode: testing
tags: [smoke, lindol]
timeout: 180
max_steps: 25
headless: true
url: https://lindol-one.vercel.app
---

# Another city, then Tagalog

## Type a city and refresh
Go to the start URL.
Wait until loading finishes.
Replace the city field with Davao City and click Refresh. Do not click a row in the suggestion list.
Wait until loading finishes.
Verify the results text names Davao City.
Verify the results do not describe the search as being for Manila.
If earthquakes are listed, verify the first one shows a magnitude starting with M and a distance in km.

## Tagalog
Click Tagalog.
Verify the earthquakes heading is "Mga lindol".
Verify the PHIVOLCS banner is still visible.
Click English.
Verify the earthquakes heading is "Earthquakes".
