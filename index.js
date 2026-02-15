const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.port || 5001;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.dxoja8w.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    app.get('/', (req, res) => {
      res.send('Server is running!');
    });

    const userCollection = client.db("vibe").collection("users");
    const workCollection = client.db("vibe").collection("works");




    // user related api
    app.get('/users',async(req,res)=>{
      const email=req.query.email;
      const query={email:email};
      const result=await userCollection.findOne(query);
      if(result){
        res.send(result);
      }
      else{
        const allUser=await userCollection.find().toArray();
        res.send(allUser);
      }
    })
    app.get('/users/hr',async(req,res)=>{
      const email=req.query.email;
      const filter={email:email};
      const user=await userCollection.findOne(filter);
      let hr=false;
      if(user){
        hr=user?.role==='HR';
      }
      res.send({hr});
    })
    app.get('/users/admin',async(req,res)=>{
      const email=req.query.email;
      const filter={email:email};
      const user=await userCollection.findOne(filter);
      let admin=false;
      if(user){
        admin=user?.role==='admin';
      }
      res.send({admin});
    })
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    app.patch('/users', async (req, res) => {
      const user=req.body;
      const email = req.query.email;
      const filter = { email:email };
      const updatedDoc = {
        $set: {
          bankAccountNo:user.bankAccountNo,
          designation:user.designation,
          salary:user.salary,
        }
      }
      const result=await userCollection.updateOne(filter,updatedDoc);
      res.send(result);
    })


    // work-sheet related apis
    app.get('/works',async(req,res)=>{
      const email=req.query.email;
      const filter={email:email};
      const filtered=await workCollection.findOne(filter);
      if(filtered){
        res.send(filtered);
      }
      else{
        const allWorks=await workCollection.find().toArray();
        res.send(allWorks);
      }
    })
    app.post('/works',async(req,res)=>{
      const work=req.body;
      const result=await workCollection.insertOne(work);
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
