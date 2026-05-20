import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hunchesRouter from "./hunches";
import categoriesRouter from "./categories";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(hunchesRouter);
router.use(categoriesRouter);
router.use(adminRouter);

export default router;
