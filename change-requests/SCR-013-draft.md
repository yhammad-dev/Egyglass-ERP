Total GTV MoM Color (Same Days) = VAR _sel = [_Selected Period]
VAR _cur =
    SWITCH(_sel,
        "MTD", CALCULATE([Total GTV], DATESMTD('Calendar'[Date])),
        "QTD", CALCULATE([Total GTV], DATESQTD('Calendar'[Date])),
        "YTD", CALCULATE([Total GTV], DATESYTD('Calendar'[Date]))
    )
VAR _prv =
    SWITCH(_sel,
        "MTD", [GTV PM (Same Days)],
        "QTD", CALCULATE(CALCULATE([Total GTV], DATESQTD('Calendar'[Date])), PARALLELPERIOD('Calendar'[Date], -1, QUARTER)),
        "YTD", CALCULATE(CALCULATE([Total GTV], DATESYTD('Calendar'[Date])), PREVIOUSYEAR('Calendar'[Date]))
    )
RETURN
IF(_prv = 0, BLANK(), IF(DIVIDE(_cur - _prv, _prv, 0) > 0, "#2DA87A", "#E84040"))