from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta, date

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Dra. Brinquinho API")
api_router = APIRouter(prefix="/api")


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# =====================
# Models
# =====================
class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku: str
    name: str
    category: str = "Geral"  # Brinco, Material, Insumo, Procedimento, Outros
    material: Optional[str] = ""
    size: Optional[str] = ""
    color: Optional[str] = ""
    purchase_value: float = 0.0
    sale_value: float = 0.0
    indirect_cost_pct: float = 20.0  # %
    stock_qty: int = 0
    min_stock: int = 0
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_utc_iso)


class ProductCreate(BaseModel):
    sku: Optional[str] = None
    name: str
    category: Optional[str] = "Geral"
    material: Optional[str] = ""
    size: Optional[str] = ""
    color: Optional[str] = ""
    purchase_value: float = 0.0
    sale_value: float = 0.0
    indirect_cost_pct: float = 20.0
    stock_qty: int = 0
    min_stock: int = 0
    notes: Optional[str] = ""


class Patient(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    child_name: Optional[str] = ""
    parent_name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    birth_date: Optional[str] = ""
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_utc_iso)


class PatientCreate(BaseModel):
    child_name: Optional[str] = ""
    parent_name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    birth_date: Optional[str] = ""
    notes: Optional[str] = ""


class Appointment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: Optional[str] = ""
    patient_name: str  # who comes (parent or adult)
    child_name: Optional[str] = ""
    procedure_type: str  # perfuração baby / piercing / lobuloplastia / laser / laserterapia
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    status: str = "agendado"  # agendado, realizado, cancelado
    notes: Optional[str] = ""
    post_sale_date: Optional[str] = ""  # auto +45 days from date
    reminder_status: str = "pendente"  # pendente, enviado
    created_at: str = Field(default_factory=now_utc_iso)


class AppointmentCreate(BaseModel):
    patient_id: Optional[str] = ""
    patient_name: str
    child_name: Optional[str] = ""
    procedure_type: str
    date: str
    time: str
    status: Optional[str] = "agendado"
    notes: Optional[str] = ""


class SaleItem(BaseModel):
    product_id: Optional[str] = ""
    name: str
    qty: int = 1
    unit_price: float = 0.0
    unit_cost: float = 0.0


class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sale_date: str  # YYYY-MM-DD
    patient_id: Optional[str] = ""
    patient_name: Optional[str] = ""
    child_name: Optional[str] = ""
    items: List[SaleItem] = []
    description: Optional[str] = ""
    gross_value: float = 0.0
    payment_method_id: Optional[str] = ""
    payment_method_name: str = ""
    card_fee_pct: float = 0.0
    fee_amount: float = 0.0
    net_value: float = 0.0  # gross - fee
    total_cost: float = 0.0
    profit: float = 0.0  # gross - cost - fee
    receive_date: Optional[str] = ""  # date+45 for cards optional; here set = sale_date by default
    post_sale_date: Optional[str] = ""  # sale_date + 45 days
    appointment_id: Optional[str] = ""
    created_at: str = Field(default_factory=now_utc_iso)


class SaleCreate(BaseModel):
    sale_date: str
    patient_id: Optional[str] = ""
    patient_name: Optional[str] = ""
    child_name: Optional[str] = ""
    items: List[SaleItem] = []
    description: Optional[str] = ""
    payment_method_id: str
    card_fee_pct: Optional[float] = None  # manual override; None = use default from method
    appointment_id: Optional[str] = ""


class ProcedureItem(BaseModel):
    product_id: Optional[str] = ""
    name: str
    qty: float = 1.0
    unit_cost: float = 0.0


class Procedure(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = ""
    items: List[ProcedureItem] = []
    indirect_cost_pct: float = 20.0
    margin_pct: float = 100.0
    manual_price: float = 0.0  # 0 = use suggested
    active: bool = True
    created_at: str = Field(default_factory=now_utc_iso)


class ProcedureCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    items: List[ProcedureItem] = []
    indirect_cost_pct: float = 20.0
    margin_pct: float = 100.0
    manual_price: float = 0.0
    active: bool = True


class PaymentMethod(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    card_fee_pct: float = 0.0
    is_card: bool = False
    active: bool = True
    created_at: str = Field(default_factory=now_utc_iso)


class PaymentMethodCreate(BaseModel):
    name: str
    card_fee_pct: float = 0.0
    is_card: bool = False
    active: bool = True


# =====================
# Helpers
# =====================
async def next_sku() -> str:
    count = await db.products.count_documents({})
    return f"SKU{1000 + count + 1}"


async def ensure_default_payment_methods():
    count = await db.payment_methods.count_documents({})
    if count == 0:
        defaults = [
            {"name": "Dinheiro", "card_fee_pct": 0.0, "is_card": False},
            {"name": "PIX", "card_fee_pct": 0.0, "is_card": False},
            {"name": "Cartão Débito", "card_fee_pct": 1.99, "is_card": True},
            {"name": "Cartão Crédito", "card_fee_pct": 3.99, "is_card": True},
        ]
        for d in defaults:
            pm = PaymentMethod(**d)
            await db.payment_methods.insert_one(pm.model_dump())


# =====================
# Products / Estoque
# =====================
@api_router.get("/products", response_model=List[Product])
async def list_products(q: Optional[str] = None):
    query = {}
    if q:
        query = {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"sku": {"$regex": q, "$options": "i"}},
            {"category": {"$regex": q, "$options": "i"}},
        ]}
    items = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return items


@api_router.post("/products", response_model=Product)
async def create_product(payload: ProductCreate):
    data = payload.model_dump()
    if not data.get("sku"):
        data["sku"] = await next_sku()
    prod = Product(**data)
    await db.products.insert_one(prod.model_dump())
    return prod


@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, payload: ProductCreate):
    existing = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Produto não encontrado")
    data = payload.model_dump()
    if not data.get("sku"):
        data["sku"] = existing["sku"]
    existing.update(data)
    await db.products.update_one({"id": product_id}, {"$set": data})
    return Product(**existing)


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Produto não encontrado")
    return {"ok": True}


# =====================
# Patients
# =====================
@api_router.get("/patients", response_model=List[Patient])
async def list_patients(q: Optional[str] = None):
    query = {}
    if q:
        query = {"$or": [
            {"parent_name": {"$regex": q, "$options": "i"}},
            {"child_name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]}
    items = await db.patients.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return items


@api_router.post("/patients", response_model=Patient)
async def create_patient(payload: PatientCreate):
    pt = Patient(**payload.model_dump())
    await db.patients.insert_one(pt.model_dump())
    return pt


@api_router.put("/patients/{patient_id}", response_model=Patient)
async def update_patient(patient_id: str, payload: PatientCreate):
    existing = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Paciente não encontrado")
    data = payload.model_dump()
    existing.update(data)
    await db.patients.update_one({"id": patient_id}, {"$set": data})
    return Patient(**existing)


@api_router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str):
    res = await db.patients.delete_one({"id": patient_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Paciente não encontrado")
    return {"ok": True}


# =====================
# Appointments
# =====================
def compute_post_sale_date(d: str) -> str:
    try:
        dt = datetime.strptime(d, "%Y-%m-%d").date()
        return (dt + timedelta(days=45)).isoformat()
    except Exception:
        return ""


@api_router.get("/appointments", response_model=List[Appointment])
async def list_appointments(date_from: Optional[str] = None, date_to: Optional[str] = None):
    query = {}
    if date_from or date_to:
        query["date"] = {}
        if date_from:
            query["date"]["$gte"] = date_from
        if date_to:
            query["date"]["$lte"] = date_to
    items = await db.appointments.find(query, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(5000)
    return items


@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(payload: AppointmentCreate):
    data = payload.model_dump()
    appt = Appointment(**data)
    appt.post_sale_date = compute_post_sale_date(appt.date)
    await db.appointments.insert_one(appt.model_dump())
    return appt


@api_router.put("/appointments/{appt_id}", response_model=Appointment)
async def update_appointment(appt_id: str, payload: AppointmentCreate):
    existing = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Agendamento não encontrado")
    data = payload.model_dump()
    data["post_sale_date"] = compute_post_sale_date(data["date"])
    existing.update(data)
    await db.appointments.update_one({"id": appt_id}, {"$set": data})
    return Appointment(**existing)


@api_router.delete("/appointments/{appt_id}")
async def delete_appointment(appt_id: str):
    res = await db.appointments.delete_one({"id": appt_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Agendamento não encontrado")
    return {"ok": True}


@api_router.post("/appointments/{appt_id}/mark-reminder-sent")
async def mark_reminder_sent(appt_id: str):
    res = await db.appointments.update_one({"id": appt_id}, {"$set": {"reminder_status": "enviado"}})
    if res.matched_count == 0:
        raise HTTPException(404, "Agendamento não encontrado")
    return {"ok": True}


# =====================
# Payment Methods
# =====================
@api_router.get("/payment-methods", response_model=List[PaymentMethod])
async def list_payment_methods():
    await ensure_default_payment_methods()
    items = await db.payment_methods.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return items


@api_router.post("/payment-methods", response_model=PaymentMethod)
async def create_payment_method(payload: PaymentMethodCreate):
    pm = PaymentMethod(**payload.model_dump())
    await db.payment_methods.insert_one(pm.model_dump())
    return pm


@api_router.put("/payment-methods/{pm_id}", response_model=PaymentMethod)
async def update_payment_method(pm_id: str, payload: PaymentMethodCreate):
    existing = await db.payment_methods.find_one({"id": pm_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Forma de pagamento não encontrada")
    data = payload.model_dump()
    existing.update(data)
    await db.payment_methods.update_one({"id": pm_id}, {"$set": data})
    return PaymentMethod(**existing)


@api_router.delete("/payment-methods/{pm_id}")
async def delete_payment_method(pm_id: str):
    res = await db.payment_methods.delete_one({"id": pm_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Forma de pagamento não encontrada")
    return {"ok": True}


# =====================
# Procedures (Precificação)
# =====================
def enrich_procedure(p: dict) -> dict:
    items = p.get("items", [])
    items_cost = sum(float(i.get("qty", 0)) * float(i.get("unit_cost", 0)) for i in items)
    indirect_pct = float(p.get("indirect_cost_pct", 0))
    margin_pct = float(p.get("margin_pct", 0))
    indirect_value = round(items_cost * indirect_pct / 100, 2)
    total_cost = round(items_cost + indirect_value, 2)
    margin_value = round(total_cost * margin_pct / 100, 2)
    suggested_price = round(total_cost + margin_value, 2)
    manual = float(p.get("manual_price", 0) or 0)
    final_price = manual if manual > 0 else suggested_price
    p["items_cost"] = round(items_cost, 2)
    p["indirect_value"] = indirect_value
    p["total_cost"] = total_cost
    p["margin_value"] = margin_value
    p["suggested_price"] = suggested_price
    p["final_price"] = round(final_price, 2)
    return p


@api_router.get("/procedures")
async def list_procedures():
    items = await db.procedures.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return [enrich_procedure(p) for p in items]


@api_router.post("/procedures")
async def create_procedure(payload: ProcedureCreate):
    proc = Procedure(**payload.model_dump())
    doc = proc.model_dump()
    await db.procedures.insert_one(doc)
    doc.pop("_id", None)
    return enrich_procedure(doc)


@api_router.put("/procedures/{proc_id}")
async def update_procedure(proc_id: str, payload: ProcedureCreate):
    existing = await db.procedures.find_one({"id": proc_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Procedimento não encontrado")
    data = payload.model_dump()
    existing.update(data)
    await db.procedures.update_one({"id": proc_id}, {"$set": data})
    return enrich_procedure(existing)


@api_router.delete("/procedures/{proc_id}")
async def delete_procedure(proc_id: str):
    res = await db.procedures.delete_one({"id": proc_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Procedimento não encontrado")
    return {"ok": True}


# =====================
# Sales
# =====================
async def compute_sale(payload: SaleCreate) -> Sale:
    pm = await db.payment_methods.find_one({"id": payload.payment_method_id}, {"_id": 0})
    if not pm:
        raise HTTPException(400, "Forma de pagamento inválida")
    items = [i if isinstance(i, SaleItem) else SaleItem(**i) for i in payload.items]
    gross = sum(i.qty * i.unit_price for i in items)
    cost = sum(i.qty * i.unit_cost for i in items)
    # Allow manual fee override (oscillating card fees). If None, use method default.
    if payload.card_fee_pct is not None:
        fee_pct = float(payload.card_fee_pct)
    else:
        fee_pct = pm.get("card_fee_pct", 0.0) if pm.get("is_card") else 0.0
    fee_amount = round(gross * fee_pct / 100, 2)
    net_value = round(gross - fee_amount, 2)
    profit = round(gross - cost - fee_amount, 2)
    post_sale = compute_post_sale_date(payload.sale_date)
    receive_date = (datetime.strptime(payload.sale_date, "%Y-%m-%d").date() + timedelta(days=30)).isoformat() if pm.get("is_card") else payload.sale_date
    sale = Sale(
        sale_date=payload.sale_date,
        patient_id=payload.patient_id or "",
        patient_name=payload.patient_name or "",
        child_name=payload.child_name or "",
        items=items,
        description=payload.description or "",
        gross_value=round(gross, 2),
        payment_method_id=pm["id"],
        payment_method_name=pm["name"],
        card_fee_pct=fee_pct,
        fee_amount=fee_amount,
        net_value=net_value,
        total_cost=round(cost, 2),
        profit=profit,
        receive_date=receive_date,
        post_sale_date=post_sale,
        appointment_id=payload.appointment_id or "",
    )
    return sale


@api_router.get("/sales", response_model=List[Sale])
async def list_sales(month: Optional[str] = None):
    """month format: YYYY-MM"""
    query = {}
    if month:
        query["sale_date"] = {"$regex": f"^{month}"}
    items = await db.sales.find(query, {"_id": 0}).sort("sale_date", -1).to_list(5000)
    return items


@api_router.post("/sales", response_model=Sale)
async def create_sale(payload: SaleCreate):
    sale = await compute_sale(payload)
    await db.sales.insert_one(sale.model_dump())
    # decrement stock
    for it in sale.items:
        if it.product_id:
            await db.products.update_one(
                {"id": it.product_id},
                {"$inc": {"stock_qty": -int(it.qty)}}
            )
    return sale


@api_router.delete("/sales/{sale_id}")
async def delete_sale(sale_id: str):
    existing = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Venda não encontrada")
    for it in existing.get("items", []):
        if it.get("product_id"):
            await db.products.update_one(
                {"id": it["product_id"]},
                {"$inc": {"stock_qty": int(it.get("qty", 0))}}
            )
    await db.sales.delete_one({"id": sale_id})
    return {"ok": True}


# =====================
# Dashboard
# =====================
@api_router.get("/dashboard")
async def dashboard():
    today = date.today().isoformat()
    month_prefix = today[:7]

    # Today appointments
    today_appts = await db.appointments.count_documents({"date": today})

    # Month sales
    sales_cursor = db.sales.find({"sale_date": {"$regex": f"^{month_prefix}"}}, {"_id": 0})
    month_sales = await sales_cursor.to_list(5000)
    total_gross = sum(s.get("gross_value", 0) for s in month_sales)
    total_profit = sum(s.get("profit", 0) for s in month_sales)
    total_fees = sum(s.get("fee_amount", 0) for s in month_sales)
    total_cost = sum(s.get("total_cost", 0) for s in month_sales)
    sales_count = len(month_sales)

    # Pending post-sale reminders (post_sale_date in past 7d to next 14d, reminder_status pendente)
    seven_ago = (date.today() - timedelta(days=7)).isoformat()
    in_14 = (date.today() + timedelta(days=14)).isoformat()
    pending_reminders = await db.appointments.count_documents({
        "post_sale_date": {"$gte": seven_ago, "$lte": in_14},
        "reminder_status": "pendente",
        "status": {"$ne": "cancelado"},
    })

    # Low stock count
    low_stock = await db.products.count_documents({
        "$expr": {"$lte": ["$stock_qty", "$min_stock"]}
    })

    # Daily sales for chart (current month)
    by_day = {}
    for s in month_sales:
        d = s.get("sale_date", "")
        by_day[d] = by_day.get(d, 0) + s.get("gross_value", 0)
    chart = [{"date": k, "value": round(v, 2)} for k, v in sorted(by_day.items())]

    # Sales by payment method
    by_pm = {}
    for s in month_sales:
        pm = s.get("payment_method_name", "—")
        by_pm[pm] = by_pm.get(pm, 0) + s.get("gross_value", 0)
    pm_chart = [{"name": k, "value": round(v, 2)} for k, v in by_pm.items()]

    return {
        "today": today,
        "month": month_prefix,
        "today_appointments": today_appts,
        "month_gross": round(total_gross, 2),
        "month_profit": round(total_profit, 2),
        "month_fees": round(total_fees, 2),
        "month_cost": round(total_cost, 2),
        "sales_count": sales_count,
        "pending_reminders": pending_reminders,
        "low_stock_count": low_stock,
        "chart_daily": chart,
        "chart_payment_methods": pm_chart,
    }


@api_router.get("/reminders/pending")
async def pending_reminders():
    seven_ago = (date.today() - timedelta(days=7)).isoformat()
    in_14 = (date.today() + timedelta(days=14)).isoformat()
    items = await db.appointments.find({
        "post_sale_date": {"$gte": seven_ago, "$lte": in_14},
        "reminder_status": "pendente",
        "status": {"$ne": "cancelado"},
    }, {"_id": 0}).sort("post_sale_date", 1).to_list(500)
    return items


@api_router.get("/reports/monthly")
async def reports_monthly(year: int = Query(..., description="Year, e.g. 2026")):
    """Aggregated monthly report for given year."""
    pipeline = [
        {"$match": {"sale_date": {"$regex": f"^{year}-"}}},
        {"$group": {
            "_id": {"$substr": ["$sale_date", 0, 7]},
            "gross": {"$sum": "$gross_value"},
            "cost": {"$sum": "$total_cost"},
            "fees": {"$sum": "$fee_amount"},
            "profit": {"$sum": "$profit"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    rows = await db.sales.aggregate(pipeline).to_list(50)
    return [{
        "month": r["_id"],
        "gross": round(r.get("gross", 0), 2),
        "cost": round(r.get("cost", 0), 2),
        "fees": round(r.get("fees", 0), 2),
        "profit": round(r.get("profit", 0), 2),
        "count": r.get("count", 0),
    } for r in rows]


@api_router.get("/")
async def root():
    return {"app": "Dra. Brinquinho", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_event():
    await ensure_default_payment_methods()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
