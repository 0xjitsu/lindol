---
mode: testing
tags: [smoke, lindol]
timeout: 180
max_steps: 25
headless: true
url: https://lindol-one.vercel.app
---

# Manila, the PHIVOLCS banner, and a quiet week

## Open Lindol
Go to the start URL.
Wait until the page is no longer stuck on "Loading earthquakes".
Verify the heading says Lindol.
Verify the yellow banner is visible, contains PHIVOLCS, and links to phivolcs.dost.gov.ph.
Verify the page says it is not an official source.

## Quiet week near Manila
Set the city to Manila if it is not already, and set the period to Last 7 days and the radius to 200 km.
Wait until loading finishes.
If earthquakes are listed, verify the summary names Manila and the first earthquake shows a magnitude starting with M and a distance in km.
If the page says there are no earthquakes in the last 7 days, verify it also names the closest earthquake in a longer period, with a magnitude and a distance in km, and shows a button that looks at the last 30 days.
Click that button when it is visible. Do not change the radius dropdown for this.
Wait until loading finishes.
Verify the summary names Manila.
If earthquakes are listed, verify the first one shows a magnitude starting with M and a distance in km.
If none are listed, verify the message says there are no earthquakes and names Manila.
