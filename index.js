const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: ["https://job-application-dd3f8.web.app", 
    "https://job-application-dd3f8.firebaseapp.com",
    "https://weak-tooth.surge.sh",
    "http://localhost:5173"
    ],
    
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ldrxrdq.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const logger = (req, res, next) => {
  
  next();
};

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  // console.log("Value of token", token);
  if (!token) {
    return res.status(401).send({ message: "Not authorized" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "Unauthorized" });
    }
    // console.log("value in the token of decoded", decoded);
    req.user = decoded;

    next();
  });
};

async function run() {
  try {
    // await client.connect();

    const jobsCollection = client.db("jobApply").collection("jobs");
    const applyCollection = client.db("jobApply").collection("applied");
    const testimonialCollection = client.db("jobApply").collection("addTestimonial");
    app.post("/auth", logger, async (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite:'none'
        })
        .send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      const user = req.body;
      
      res.clearCookie("token", { maxAge: 0, secure:process.env.NODE_ENV === "production" ? true : false, sameSite:process.env.NODE_ENV === "production" ? "none" : "strict" }).send({ success: true });
    });

    app.post("/addajobs", async (req, res) => {
      const newJob = req.body;

      newJob.date = new Date();
      newJob.applicants = newJob.applicants || 0;
      const result = await jobsCollection.insertOne(newJob);
      
      res.status(201).json({ success: true, jobId: result.insertedId });
    });

    app.post("/applied", async (req, res) => {
      const apply = req.body;

      const result = await applyCollection.insertOne(apply);
      const jobId = new ObjectId(apply.jobId);

      const filter = { _id: jobId };
      const update = {
        $inc: { applicants: 1 },
      };
      await jobsCollection.updateOne(filter, update);

      res
        .status(200)
        .json({
          success: true,
          message: "Job application submitted successfully",
        });
    });

    app.get("/jobscategory", async (req, res) => {
      const category = req.params.category;

      const query = { category: category };

      const result = await jobsCollection.find(query).toArray();

      res.send(result);
    });

    app.get("/allJobs", async (req, res) => {
      const result = await jobsCollection.find().toArray();
      res.send(result);
    });

    app.get("/myJobs", logger, verifyToken, async (req, res) => {
      let query = {};
      const email = req.query?.email;
        //verify
        if(req.query.email !== req.user.email){
          return res.status(403).send({message: 'forbidden'})
        }
        
      if (email) {
        query = { userEmail: email };
      }

      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/applied", logger, verifyToken, async (req, res) => {
     
      const email = req.query?.email;
      // console.log(email)
      
      // console.log('user',req.user.email)

      //verify
      if(req.query.email !== req.user.email){
        return res.status(403).send({message: 'forbidden'})
      }


      let query = {};
      if (email) {
        query = { email: email };
      }
      const result = await applyCollection.find(query).toArray();
    
      res.send(result);
    });

    app.get("/jobdetails/:_id", async (req, res) => {
      const jobId = req.params._id;
      const query = { _id: new ObjectId(jobId) };
      const job = await jobsCollection.findOne(query);

      res.send(job);
    });
    app.put("/updateJobs/:_id", async (req, res) => {
      const id = req.params._id;
      const job = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };

      const updateJob = {
        $set: job,
      };

      const result = await jobsCollection.updateOne(filter, updateJob, options);

      if (result.modifiedCount > 0) {
        res.send(result);
      }
    });

    app.delete("/deleteJob/:_id", async (req, res) => {
      const id = req.params._id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.deleteOne(query);
      res.send(result);
    });


    app.post("/addTestimonial", async (req, res) => {
      const newTestimonial = req.body;

      const result = await testimonialCollection.insertOne(newTestimonial);
      
      res.send(result)
    });

    
    app.get("/testimonials", async (req, res) => {
      const result = await testimonialCollection.find().toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("job apply is running");
});

app.listen(port, () => {
  console.log(`job apply server is running on port: ${port}`);
});
