# tab-reloader

A high-precision Chrome extension built on Manifest V3 that reloads tabs based on strict intervals or exact times down to the millisecond. It features a built-in latency tester and predictive offset math to ensure requests arrive at the server at the exact target millisecond.

## Features

* **High-Precision Scheduling:** Reload tabs on an interval (e.g., every 1.500 seconds) or at a specific 24-hour time (e.g., `14:30:00.500`).
* **Latency Compensation (RTT):** Built-in ping tool measures the exact time it takes to reach a target server. The extension can automatically fire early by that exact offset so the request arrives on the dot.
* **Flexible Targeting:** Target the active tab, all tabs, or filter tabs by matching URL patterns (e.g., `example.com`), isolated by the current window or across all open Chrome windows.
* **Floating Live Timer:** Projects a click-through countdown timer directly onto web pages, keeping you synced even when the extension popup is closed.

## Installation

Because this extension uses rapid timers, it is intended to be run locally as an unpacked extension.

1. Download or clone this repository to a folder on your computer.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. In the top right corner, toggle **Developer mode** to **ON**.
4. Click the **Load unpacked** button in the top left.
5. Select the `tab-reloader` folder.
6. The extension is now installed. Pin it to your toolbar for easy access.

## Usage Guide

1. **Target by URL:** Check "Enable match" and enter a domain (like `google.com`). Only tabs containing this string in their URL will be reloaded.
2. **Target by Tab & Window:** Choose whether to reload just your currently active tab, all tabs, or none (relying strictly on the URL match above).
3. **Set Timing:**
* **Interval:** Enter a time in seconds. Decimals are fully supported (e.g., `2.5` for 2.5 seconds).
* **Specific Time:** Enter a target time in 24-hour format (`HH:MM:SS.mmm`). Click "Add" to queue multiple target times.
4. **Latency Offset:**
* Enter your target URL in the URL field and click **Test Latency**.
* Check **Fire early to negate latency**.
* If a reload is scheduled for `12:00:00.000` and your latency is `150ms`, the extension will execute the reload at exactly `11:59:59.850`.

## Known limitations
* The smallest time unit used is **50ms**, so the extension uses time in multiples of 50ms.
* Latency Offset uses **RTT**, so it reloads sooner than optimal, but this is sufficient for my needs, so I wont optimize it as of now. (I could just do rtt_time/2, but this way theres a failsafe in case it reloads few ms too early.)
* Popup doesn't update when new option or time is added, selected or changed. Clicking **Start** to *restart* the logic is required.
