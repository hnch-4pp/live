import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hunchesRouter from "./hunches";
import categoriesRouter from "./categories";
import adminRouter from "./admin";
import authRouter from "./auth";
import placesRouter from "./places";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(placesRouter);
router.use(storageRouter);
router.use(hunchesRouter);
router.use(categoriesRouter);
router.use(adminRouter);

export default router;
