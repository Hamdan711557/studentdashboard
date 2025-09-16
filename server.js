const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const morgan = require("morgan");
const winston = require("winston");

const app = express();

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use(morgan(":method :url :status :response-time ms - :res[content-length]"));

// ---------- Logger (Winston) ----------
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// ---------- MongoDB Connection ----------
mongoose
  .connect(
    process.env.MONGODB_URI ||
      "mongodb+srv://Hamdan:rash123@cluster0.ephmgfj.mongodb.net/student-dashboard",
    { useNewUrlParser: true, useUnifiedTopology: true }
  )
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ---------- Schemas ----------
const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    course: { type: String, required: true },
    enrollmentDate: { type: Date, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

const Student = mongoose.model("Student", studentSchema);

const courseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    duration: { type: Number, required: true }, // in months
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

const Course = mongoose.model("Course", courseSchema);

// ---------- Course Routes ----------
app.get("/api/courses", async (req, res) => {
  try {
    const courses = await Course.find().sort({ name: 1 });
    res.json(courses);
  } catch (error) {
    logger.error("Error fetching courses:", error);
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/courses", async (req, res) => {
  try {
    const course = new Course(req.body);
    const savedCourse = await course.save();
    res.status(201).json(savedCourse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put("/api/courses/:id", async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/courses/:id", async (req, res) => {
  try {
    const enrolledStudents = await Student.countDocuments({
      course: req.params.id,
    });
    if (enrolledStudents > 0) {
      return res
        .status(400)
        .json({ message: "Cannot delete course with enrolled students" });
    }

    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });

    res.json({ message: "Course deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/courses/:id", async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- Student Routes ----------
app.get("/api/students", async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/students", async (req, res) => {
  try {
    const student = new Student(req.body);
    const savedStudent = await student.save();
    res.status(201).json(savedStudent);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put("/api/students/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/students/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Search Students
app.get("/api/students/search", async (req, res) => {
  try {
    const searchTerm = req.query.q;
    const students = await Student.find({
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { course: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
      ],
    });
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single student
app.get("/api/students/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- Dashboard Stats ----------
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const activeStudents = await Student.countDocuments({ status: "active" });
    const totalCourses = await Course.countDocuments();
    const activeCourses = await Course.countDocuments({ status: "active" });
    const graduates = await Student.countDocuments({ status: "inactive" });
    const courseCounts = await Student.aggregate([
      { $group: { _id: "$course", count: { $sum: 1 } } },
    ]);

    res.json({
      totalStudents,
      activeStudents,
      totalCourses,
      activeCourses,
      graduates,
      courseCounts,
      successRate:
        totalStudents > 0
          ? Math.round((graduates / totalStudents) * 100)
          : 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.get("/api/reports", async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();

    // Count unique courses
    const uniqueCourses = await Student.distinct("course");

    // Group students by course
    const studentsByCourseAgg = await Student.aggregate([
      { $group: { _id: "$course", count: { $sum: 1 } } }
    ]);
    const studentsByCourse = {};
    studentsByCourseAgg.forEach(c => studentsByCourse[c._id] = c.count);

    res.json({
      totalStudents,
      totalCourses: uniqueCourses.length,
      studentsByCourse
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error generating reports" });
  }
});
// ---------- Health Checks ----------
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.get("/health/detailed", (req, res) => {
  const dbStatus =
    mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";
  res.status(200).json({
    status: "UP",
    timestamp: new Date(),
    database: { status: dbStatus, name: "MongoDB" },
    environment: process.env.NODE_ENV || "development",
  });
});
