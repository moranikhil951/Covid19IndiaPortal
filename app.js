const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const path = require("path");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
dbPath = path.join(__dirname, "covid19IndiaPortal.db");
db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error :${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const validateGetResponse = (object) => {
  return {
    stateId: object.state_id,
    stateName: object.state_name,
    population: object.population,
  };
};

const validateAddResponse = (object) => {
  return {
    districtId: object.district_id,
    districtName: object.district_name,
    stateId: object.state_id,
    cases: object.cases,
    cured: object.cured,
    active: object.active,
    deaths: object.deaths,
  };
};
function authenticationToken(request, response, next) {
  let jwtToken;
  const authHeaders = request.headers["authorization"];
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "nikhil", async (error, payload) => {
      if (error) {
        response.status(401);
        response.status("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const updateOuery = `
select * from user 
where username = '${username}'
`;
  const dbUser = await db.get(updateOuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "nikhil");

      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authenticationToken, async (request, response) => {
  let jwtToken;
  const authHeaders = request.headers["authorization"];
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "nikhil", async (error, payload) => {
        if (error) {
          response.status(401);
          response.status("Invalid JWT Token");
        } else {
          const getStateQuery = `
    SELECT * FROM state
    order by state_id
    `;
          const dbResponseArray = await db.all(getStateQuery);
          response.send(
            dbResponseArray.map((eachState) => validateGetResponse(eachState))
          );
        }
      });
    }
  }
});

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT * 
    FROM state
    WHERE 
    state_id = '${stateId}'
    `;
  const stateArray = await db.get(getStateQuery);
  response.send(validateGetResponse(stateArray));
});

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictDetails = `
 INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
 VALUES (
    
     '${districtName}',
     ${stateId},
     ${cases},
     ${cured},
     ${active},
     ${deaths}
     
     )
     
 `;
  const arrayResponse = await db.run(addDistrictDetails);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT * 
    FROM district
    WHERE 
    district_id = '${districtId}'
    `;
    const districtArray = await db.get(getDistrictQuery);
    response.send(validateAddResponse(districtArray));
  }
);

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM 
    district 
    WHERE 
    district_id = ${districtId};
    `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updatedDistrictQuery = `
    UPDATE district 
    SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    where 
    district_id
    `;
    await db.run(updatedDistrictQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `
    SELECT 
        SUM(cases) as Cases,
        SUM(cured) as Cured,
        SUM(active) as Active,
        SUM(deaths) as Deaths
    FROM 
        district 
    where 
        state_id = ${stateId}
    ;

    `;
    const stats = await db.get(getStatsQuery);
    response.send({
      totalCases: stats["Cases"],
      totalCured: stats["Cured"],
      totalActive: stats["Active"],
      totalDeaths: stats["Deaths"],
    });
  }
);

module.exports = app;
