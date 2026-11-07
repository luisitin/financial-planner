# tools/extract-purchase-data.py -- writes modules/overview/guesses/data/purchase.js, the tables behind "when did you buy
# your home" (overview/guesses estimators/purchase.js). Three tables:
#   acs2025_owner_households_by_age_us   Census Bureau, ACS 2025 1-year, B25007 (owner households by age of householder),
#                                        read from the table-based summary file (the same file as the share table in home.js)
#   pmms30_annual_average_by_year        Freddie Mac PMMS, the 30-year fixed rate: the mean of each year's weekly figures,
#                                        from the published workbook PMMS_history (historicalweeklydata.xlsx), 1971 to 2026
#   nar2025_home_buyer_profile           the National Association of Realtors' 2025 Profile of Home Buyers and Sellers, as
#                                        published in its 2025-11-04 news release (typed in from that page; nothing to download)
#   fhfa_hpi_national_annual             FHFA, House Price Index for the nation, all-transactions, annual (hpi_at_national.xlsx): the
#                                        index the state table (home.js) lacks for a plan with no state
# Usage:   python3 -I tools/extract-purchase-data.py <folder with b25007_2025.dat, pmms.xlsx and hpi_national.xlsx> <read date YYYY-MM-DD>
# (needs: pip install openpyxl). The files come from
#   https://www2.census.gov/programs-surveys/acs/summary_file/2025/table-based-SF/data/1YRData/acsdt1y2025-b25007.dat
#   https://www.freddiemac.com/pmms/docs/historicalweeklydata.xlsx
#   https://www.fhfa.gov/hpi/download/annual/hpi_at_national.xlsx   (saved as hpi_national.xlsx)
import csv, collections, datetime, json, os, sys

src, read_on = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "modules", "overview", "guesses", "data", "purchase.js")

rows = list(csv.reader(open(os.path.join(src, "b25007_2025.dat")), delimiter="|"))
h = rows[0]
us = next(r for r in rows[1:] if r[0].startswith("0100000US"))
owners = [int(us[h.index("B25007_E%03d" % i)]) for i in range(3, 12)]

import openpyxl
wb = openpyxl.load_workbook(os.path.join(src, "pmms.xlsx"), read_only=True)
agg = collections.defaultdict(list)
for r in wb["Full History"].iter_rows(values_only=True):
    if isinstance(r[0], datetime.datetime) and isinstance(r[1], (int, float)):
        agg[r[0].year].append(r[1])
years = sorted(agg)
rate = [round(sum(agg[y]) / len(agg[y]), 2) for y in years]
last_week = max(r[0] for r in wb["Full History"].iter_rows(values_only=True) if isinstance(r[0], datetime.datetime) and isinstance(r[1], (int, float)))

hw = openpyxl.load_workbook(os.path.join(src, "hpi_national.xlsx"), read_only=True, data_only=True)["national"]
hpi = [(int(r[0]), float(r[2])) for r in hw.iter_rows(values_only=True) if isinstance(r[0], int) and isinstance(r[2], (int, float))]

common = {"stat": "average", "dollarsOf": None, "industry": False, "derived": False, "readOn": read_on}
T = {
  "acs2025_owner_households_by_age_us": {
    "title": "Homeowner households, by age of the householder",
    "publisher": "U.S. Census Bureau, American Community Survey",
    "table": "B25007 Tenure by Age of Householder (2025 ACS 1-year estimates, table-based summary file), owner-occupied rows",
    "url": "https://www2.census.gov/programs-surveys/acs/summary_file/2025/table-based-SF/data/1YRData/acsdt1y2025-b25007.dat",
    "vintage": "2025 ACS 1-year estimates (survey year 2025), files posted 2026-10-29",
    **{**common, "stat": "count"}, "unit": "households",
    "org": "U.S. Census Bureau", "shownBy": "U.S. Census Bureau, American Community Survey",
    "tableShown": "B25007 Tenure by Age of Householder (2025 ACS 1-year estimates, table-based summary file)",
    "asOf": "2025 figures, published October 2026", "by": "ageOfHouseholder",
    "cols": ["15 to 24", "25 to 34", "35 to 44", "45 to 54", "55 to 59", "60 to 64", "65 to 74", "75 to 84", "85 and over"],
    "rows": {"owners": owners},
  },
  "pmms30_annual_average_by_year": {
    "title": "Rate on a 30-year fixed mortgage, average of each year",
    "publisher": "Freddie Mac",
    "table": "Primary Mortgage Market Survey (PMMS), 30-year fixed-rate mortgage, weekly U.S. averages (historicalweeklydata.xlsx), averaged by calendar year",
    "url": "https://www.freddiemac.com/pmms/docs/historicalweeklydata.xlsx",
    "vintage": "weekly figures 1971-04-02 to %s; 2026 is the year so far" % last_week.date().isoformat(),
    **common, "unit": "percent a year",
    "org": "Freddie Mac", "shownBy": "Freddie Mac",
    "tableShown": "Primary Mortgage Market Survey, weekly history, averaged by year",
    "asOf": "weekly figures to %s (worked out here: the mean of each year's weeks)" % last_week.date().isoformat(), "by": "year",
    "cols": [str(y) for y in years],
    "rows": {"30-year fixed": rate},
  },
  "fhfa_hpi_national_annual": {
    "title": "Home price index, United States, by year",
    "publisher": "Federal Housing Finance Agency (FHFA)",
    "table": "HPI for the nation (All-Transactions Index), Experimental Indexes Showing Cumulative (Nominal) Annual Appreciation - Annual Developmental Index, NSA (hpi_at_national.xlsx), column HPI (100 in 1975)",
    "url": "https://www.fhfa.gov/hpi/download/annual/hpi_at_national.xlsx",
    "vintage": "Last updated March 31, 2026 (covers through 2025)",
    **{**common, "stat": "index"}, "unit": "index (100 in 1975)",
    "org": "Federal Housing Finance Agency", "shownBy": "Federal Housing Finance Agency (FHFA)",
    "tableShown": "House Price Index for the nation (All-Transactions, annual)",
    "asOf": "Last updated March 31, 2026", "by": "year",
    "cols": [str(y) for y, _ in hpi],
    "rows": {"HPI": [v for _, v in hpi]},
  },
  "nar2025_home_buyer_profile": {
    "title": "Who buys homes: down payment, age and how long sellers stayed",
    "publisher": "National Association of Realtors",
    "table": "2025 Profile of Home Buyers and Sellers (transactions July 2024 to June 2025), news release 'First-Time Home Buyer Share Falls to Historic Low of 21%; Median Age Rises to 40'",
    "url": "https://www.nar.realtor/newsroom/first-time-home-buyer-share-falls-to-historic-low-of-21-median-age-rises-to-40",
    "vintage": "2025 Profile, released 2025-11-04",
    **{**common, "stat": "median"}, "unit": "mixed (see rows)", "industry": True,
    "org": "National Association of Realtors", "shownBy": "National Association of Realtors",
    "tableShown": "2025 Profile of Home Buyers and Sellers",
    "asOf": "July 2024 to June 2025 sales, released November 2025", "by": "buyer",
    "cols": ["first-time buyers", "repeat buyers"],
    "rows": {"median down payment (% of price)": [10, 23], "median age (years)": [40, 62]},
  },
}
js = [
  "// modules/overview/guesses/data/purchase.js",
  "// GENERATED by tools/extract-purchase-data.py (read %s). Do not edit; run it again. Tables behind the guess for the year a home" % read_on,
  "// was bought and the mortgage worked from it (../estimators/purchase.js, ../README.md \"When the home was bought\"). The Census",
  "// move-in-year table (acs2025_year_moved_in_by_age_us), the FHFA home price index and the FHFA new-loan table are in home.js and",
  "// debts.js. Values are exactly as published (the PMMS yearly figure is the mean of that year's weekly ones, to 2 decimals).",
  "// Next releases: ACS 2026 1-year: September 2027; PMMS: weekly; NAR Profile: November 2026.",
  'export const READ_ON = "%s";' % read_on,
  "export const T = {",
] + ["  %s: %s," % (k, json.dumps(v, separators=(",", ":"))) for k, v in T.items()] + ["};", "export const DERIVED = {};", ""]
open(OUT, "w").write("\n".join(js))
print("wrote", OUT, "owners", owners, "years", years[0], years[-1])
