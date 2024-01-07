<img height="64px" src="https://github.com/tools4j/stacked-off/blob/master/src/main/resources/webapp/stacked-off-white.png"/>

StackedOff is a Stack Exchange site indexer and search engine.  It's
intended use is for people who wish to access Stack Exchange Network site(s), 
e.g. <a href="https://stackoverflow.com">stackoverflow.com</a>, but do not have a reliable internet service.
StackedOff uses the 'stack dump' data files made public by the Stack Exchange Network.

<img src="https://github.com/tools4j/stacked-off/blob/master/resources/screenshot-search.png">

# Installation (Docker)

# Installation

## Pre-requisite

1. Download the latest zip version from <a href="https://github.com/tools4j/stacked-off/tree/master/dist">here</a>, and unzip into your desired location.
2. Ensure you have a version of a Java JRE installed which is <a href="https://www.oracle.com/technetwork/java/javase/downloads/jre8-downloads-2133155.html">version 8</a> or higher.
3. Ensure your JAVA_HOME environment variable is pointing to this java home directory.

## Aquiring StackExchange Data Dumps

### Simple download

The latest StackExchange data dumps can be downloaded <a href="https://ia600107.us.archive.org/27/items/stackexchange/">here</a>. Older dumps can be torrented (see next section).

**Important**: You must include in your download the Sites.xml file that is present in every data dump.

**Important**: Once downloaded, do NOT unzip the 7z site files.  StackedOff can only read from the archived site files.

### Torrenting

1. Get the 'BitTorrent Infohash' from <a href="https://meta.stackexchange.com/questions/224873/all-stack-exchange-data-dumps/224922#224922">here</a>.
2. Use your preferred BitTorrent (e.g. uTorrent) client to download a, or part of a Data Dump.

Note: Most BitTorrent clients allow you to pick and choose which files _within_ a Torrent that you
wish to download.  You will probably want to limit the files that you download, as some of them can be 
quite large.  Most of the sites are in individual 7z files.  Except for stackoverflow.com which is broken
up into a few seperate archives.  If downloading stackoverflow.com, ensure you download the Posts, Users, and Comments files.

## Running StackedOff

* Call /path/to/stacked-off/bin/stacked (if running on Linux/MacOS)
* Call C:\path\to\stacked-off\bin\stacked.bat (if running on Windows)

Launch a browser pointing at http://localhost and you should see the StackedOff GUI.

(NOTE: Your browser must be ES6 compatible.  Please see the <a href="https://www.w3schools.com/js/js_es6.asp">table here for browser version compatibility</a>.)

### Configure index dir

The first time that you run StackedOff you will be asked to specify an index directory.  This is where StackedOff
will store it's indexes.  These indexes can get quite large if you are indexing large sites such as stackoverflow.com.

* Make sure you have enough disk space.  
* It is preferable to use a local disk, as this will dramatically impact the speed of StackedOff.
* It is preferable to use an SSD disk, as this will also impact the speed of StackedOff.

### Load a site

Assuming you have downloaded a Stack Exchange site:

1. click on the 'Add Site' button.
2. Enter the path that contains the 7z file(s) and Sites.xml file that you previously downloaded.  Click 'Next'
3. Select the site(s) that you wish to index.
4. Click 'Next'

Indexing can take some time.  On my laptop (7th Gen i5, with SSD) indexing <a href="stackoverflow.com">stackoverflow.com</a> takes about 4 hours.

### Search

You should now be able to search the loaded sites, using the search bar at the top of the StackedOff gui.

### Changing the port that StackedOff uses

By default StackedOff launches on port 80.
To change this, edit the file in your home directory .stackedoff/app.properties, and add a port setting, e.g.:

`port=8080`

Re-run StackedOff.

## Building

StackedOff can be built with JDK 8-21. To build it, run `./gradlew build` on MacOS or Linux or `gradlew.bat build` on Windows. After the build is done, it will be available in `./build/distributions/`.

## Testing

StackedOff can also be built and ran via Docker. This is preferrable for testing since it's all one step, but does not produce easily distributable files.

```bash
docker-compose up -d --build
```

Go on `localhost:8080`

Place your StackExchange archive files in the `import` directory and once on the web interface, enter `/import` as _Index directory_.

> Don't forget downloading the [Sites.xml](https://archive.org/download/stackexchange/Sites.xml) file. Add it in `./import`.

## Serving

Docker can also be used to make your computer into a kind of local StackExchange server. The "production" build adds basic_auth on `/admin` (add index) and `/rest/purgeSite` (remove index) endpoints, so that accounts can be added.

Create a user and password with :

```bash
touch ./nginx/.htpasswd
htpasswd -m ./nginx/.htpasswd admin
# A password will be asked for the "admin" user
# You can add multiple accounts
```

> This may require an `apt-get install apache2-utils`

# Acknowledgments

The guys at <a href="https://stackexchange.com/">stackexchange.com</a>.  Who not only revolutionized the 
technical Q&A space, but also in the spirit of 'openness' admirably continue to allow free access to all of their
Q&A data for all of their sites.

The <a href="https://lucene.apache.org/">Lucene</a> indexing and search API.

<a href="www.jetbrains.com">JetBrains</a> for creating and maintaining the awesome <a href="https://kotlinlang.org/">Kotlin</a> 
JVM language.

# More Screenshots

## Question view

<img src="https://github.com/tools4j/stacked-off/blob/master/resources/screenshot-question.png">

## Selecting sites to index

<img src="https://github.com/tools4j/stacked-off/blob/master/resources/screenshot-selecting-site-to-index.png">
