import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hunchesRouter from "./hunches";
import categoriesRouter from "./categories";

const router: IRouter = Router();

router.use(healthRouter);
router.use(hunchesRouter);
router.use(categoriesRouter);

export default router;
