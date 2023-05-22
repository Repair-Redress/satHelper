# satHelper

Joseph Ferdinando (jgf94)
Master of Engineering in Computer Science Project Report 
Advisor: Chris Csíkszentmihályi (cpc83)
Spring 2023

SatHelper

Motivation

Massive volumes of satellite imagery are collected on monthly, weekly, and daily cadences and released free to the public mere minutes to hours after these images are taken. Programs such as Landsat administered by the US Geological Survey or the Copernicus program under the European Space Agency release this data for free, representing a massive public good. However, the data is often behind outdated user interfaces, login systems, and obfuscated by unnecessary jargon and complex file formats (see: Copernicus Open Access Hub, USGS EarthExplorer). A growing movement of both commercial and public sector are seeking to improve the accessibility, examples include Google Earth Engine, NASA WorldView, and Sentinel EO Browser, though these all require coding and knowledge of specific satellite platforms or sensors to retrieve useful images. 

Alternatively, basemap services provided by a number of sources, including but not limited to Google Maps, Bing Maps, Apple Maps, and Mapbox make satellite imagery accessible, but do not necessarily provide a comprehensive, complete, and accessible time series with date time information, instead providing a cloud-free mosaic with unknown providence. These formats are also limited to true color imagery, omitting infrared and radar images which have additional value for specific use cases. 

Citizen scientists engaged in climate change and industrial pollution monitoring, and the “Open Source Intelligence” community which monitors warzones and international crimes, all benefit from easy access to information about and from imaging satellites without needing domain expertise in remote sensing. The objective of the SatHelper project is to lower the barriers to entry to obtaining free satellite imagery. 

Opportunity

To improve on this situation, we can take a few steps:

Predict satellite overflights in cases where imaging schedules are not explicitly shared, and when applicable and available, provide weather forecasts for the image area to suggest if the area will be cloud-free on said dates;

Allow requests to be made based on the information desired, rather than satellite or sensor. For example:

A user requests thermal images to monitor urban heat islands, industrial sites, or cooling water discharge, and receives relevant images from both Landsat’s Thermal Infrared Sensors (TIRS) and the International Space Station’s ECOsystem Spaceborne Thermal Radiometer Experiment on Space Station (ECOSTRESS).

A user requests moderately high resolution true-color imagery, and receives relevant images from Landsat’s Operational Land Imager (OLI) and Sentinel-2.

A user requests moderately high resolution images of a hazy, foggy, or smoky area, and receives Sentinel-1 radar images, Landsat infrared images, and Sentinel-2 infrared images.

When images are available, download them from the various endpoints, scale, set contrast, crop, and release in a “friendly” format and size easily viewable. Typically satellite images in a single “band” (read: color channel) are 50 to 500 MB in GeoTIFF or NetCDF format; instead these could be converted to smaller scale JPG or PNG files. 

Satellite overflight reports and images can be made available via an automatic emailer, web page, or API. 

Concept and Methods

This project focuses on thermal imagery of water surface temperature at cryptocurrency mining sites to support local citizen scientists and provide a proof of concept application. The script is written in Python, using a Jupyter Notebook for rapid testing. 

The SatHelper processes simply require a point location, in latitude and longitude, but certainly extensible to other options such as address geocoding, or map selection. The National Weather Service API is queried to check forecast station based on latitude and longitude, and then retrieve localized forecast from the relevant station; then the N2YO satellite tracking API to calculate “radio passes” which show when a satellite will spot a ground location within a definable field of regard, defined by the field of view of the satellite. 

If the process is requesting imagery, the Landsat Machine to Machine API is used to retrieve available image frames. If the image frame is not available on the server, it is downloaded along with any corresponding recent collections, the number of which is defined by a “lookback” variable. The script then uses the Rasterio library from Mapbox to crop images and rescale colors to a more interpretable range. 

Satellite passes, weather, and processed images are composed and attached to an email and sent using the smtplib and email libraries. A scheduling service schedules weather updates prior to the next pass, and listens for new imagery for 24 hours after the next pass. Tasks are scheduled recursively upon the next update being sent. 


An example email from the SatHelper service.

Improving the Product

It is necessary to further streamline certain processes and create a proper product from SatHelper. The following are works in progress to make SatHelper far more robust and flexible:

SatHelper itself having a callable API for both subscribing and scheduling tasks, and making ad-hoc requests. This is being built using Flask.

Rather than storage in OS filesystems log in a geospatial aware database: subscribers, regions of interest, sent messages, full requested images, cropped and processed images. This is implemented in PostgreSQL but needs proper connection to the Flask API.

Functions to request a comprehensive history of a particular image type, not just recent images, for historic or contextual looks. This process is limited because the Landsat Machine to Machine API seems to limit access to images taken within the last year.

Adding API connections for other imagery types, satellites, particularly the European Space Agency Copernicus program API, will increase the utility of the overall product. 

Code

Repository available at: https://github.com/Repair-Redress/satHelper

