from __future__ import annotations


class ProviderError(Exception):
    pass


class FakeProvider:
    """Test double: data maps ticker -> (dates, closes)."""
    def __init__(self, data):
        self.data = data

    def dividends(self, ticker):
        return []

    def holdings(self, ticker):
        return None

    def history(self, ticker, years=10):
        if ticker not in self.data:
            raise ProviderError(f"no data for {ticker}")
        return self.data[ticker]


class YahooProvider:
    """yfinance wrapper. Unofficial source: can be delayed, wrong or rate-limited.
    Uses auto-adjusted closes so distributions are included (total return)."""
    def history(self, ticker, years=10):
        import yfinance as yf
        try:
            h = yf.Ticker(ticker + ".AX").history(period=f"{years}y", auto_adjust=True)
        except Exception as e:  # network / parsing errors
            raise ProviderError(str(e))
        h = h.dropna(subset=["Close"])
        if len(h) < 2:
            raise ProviderError(f"empty history for {ticker}")
        return [d.date().isoformat() for d in h.index], [float(x) for x in h["Close"]]

    def dividends(self, ticker):
        """Cash distributions per unit as [(iso_date, amount)]. Same unofficial source as prices."""
        import yfinance as yf
        try:
            s = yf.Ticker(ticker + ".AX").dividends
        except Exception as e:
            raise ProviderError(str(e))
        return [(d.date().isoformat(), float(v)) for d, v in s.items()]

    def holdings(self, ticker):
        """Top holdings [(name, fraction)] and sector weights {sector: fraction}. Same unofficial source."""
        import yfinance as yf
        try:
            fd = yf.Ticker(ticker + ".AX").funds_data
            th, sw = fd.top_holdings, fd.sector_weightings
            col = [c for c in th.columns if "ercent" in c][0]
            name = "Name" if "Name" in th.columns else None
            rows = [((r[name] if name else i), float(r[col])) for i, r in th.iterrows()]
            return rows, dict(sw or {})
        except Exception as e:
            raise ProviderError(str(e))
