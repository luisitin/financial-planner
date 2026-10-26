"""Primary-source history fetcher, independent of the application's history file.

NYU Stern, Aswath Damodaran, Historical Returns on Stocks, Bonds and Bills.
FRED CPI percentage-change series is included in the workbook's Inflation Rate
worksheet. Install xlrd only to refresh; ordinary regeneration reads saved CSV.
"""
import csv
import hashlib
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
FILE = ROOT/'tests/golden/retirement/sources/damodaran-1928-2025.csv'
URL = 'https://www.stern.nyu.edu/~adamodar/pc/datasets/histretSP.xls'


def refresh():
    import xlrd
    raw = urllib.request.urlopen(URL).read()
    wb = xlrd.open_workbook(file_contents=raw)
    table = wb.sheet_by_name('Returns by year')
    values = [table.row_values(i) for i in range(table.nrows)]
    columns = next(v for v in values if v[0] == 'Year')
    names = {'stocks':'S&P 500 (includes dividends)', 'bonds':'US T. Bond (10-year)', 'cash':'3-month T.Bill'}
    positions = {k:columns.index(v) for k,v in names.items()}
    price_table = wb.sheet_by_name('Inflation Rate')
    # The labeled CPI column is a percent; divide by100, rather than using
    # the workbook's precomputed unlabeled fraction column.
    prices = {int(price_table.cell_value(i,0)):float(price_table.cell_value(i,1))/100
              for i in range(price_table.nrows)
              if isinstance(price_table.cell_value(i,0),float)
              and 1928 <= price_table.cell_value(i,0) <= 2025}
    data = []
    for record in values:
        if isinstance(record[0],float) and record[0] in prices:
            year = int(record[0])
            data.append({'year':year, **{k:f'{float(record[j]):.6f}' for k,j in positions.items()},
                         'inflation':f'{prices[year]:.6f}'})
    assert len(data)==98 and [v['year'] for v in data] == list(range(1928,2026))
    FILE.parent.mkdir(parents=True,exist_ok=True)
    with FILE.open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=['year','stocks','bonds','cash','inflation'],lineterminator='\n')
        writer.writeheader();writer.writerows(data)
    print(f'{FILE.name}:98 primary-source years; source SHA256={hashlib.sha256(raw).hexdigest()}')


def load():
    if not FILE.exists(): refresh()
    with FILE.open(encoding='utf-8') as f:
        return [{k:int(v) if k=='year' else float(v) for k,v in r.items()} for r in csv.DictReader(f)]


if __name__ == '__main__':
    refresh()
