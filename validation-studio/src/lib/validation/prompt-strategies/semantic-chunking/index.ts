import { resolveIds } from "./id-resolver";
const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";


/**
 * Recursively find all keys in the object tree and check if their values
 * consist ONLY of empty GUIDs or 0 IDs across the entire set of items.
 */
function getUniversalZeroKeys(items: any[]): Set<string> {
    const keyValues = new Map<string, Set<any>>();

    function collect(node: any, path: string = "") {
        if (!node || typeof node !== "object") return;

        if (Array.isArray(node)) {
            node.forEach((item) => collect(item, path));
        } else {
            for (const [k, v] of Object.entries(node)) {
                const fullPath = path ? `${path}.${k}` : k;
                if (typeof v === "object" && v !== null) {
                    collect(v, fullPath);
                } else if (v !== undefined) {
                    if (!keyValues.has(fullPath)) keyValues.set(fullPath, new Set());
                    keyValues.get(fullPath)!.add(v);
                }
            }
        }
    }

    items.forEach((item) => collect(item));

    const zeroKeys = new Set<string>();
    for (const [path, values] of keyValues.entries()) {
        const keyName = path.split(".").pop() || "";
        const allValues = Array.from(values);

        const isAllEmptyGuid = allValues.length > 0 && allValues.every(v => v === EMPTY_GUID);
        const isAllZeroId = allValues.length > 0 &&
            (keyName.toUpperCase().includes("ID") || keyName === "ID") &&
            allValues.every(v => v === 0 || v === "0" || v === EMPTY_GUID);

        if (isAllEmptyGuid || isAllZeroId) {
            zeroKeys.add(path);
        }
    }

    return zeroKeys;
}

/**
 * Remove keys that were identified as universally zero/empty.
 */
function applyZeroKeyFilter(node: any, zeroKeys: Set<string>, path: string = ""): any {
    if (!node || typeof node !== "object") return node;

    if (Array.isArray(node)) {
        return node.map(item => applyZeroKeyFilter(item, zeroKeys, path));
    }

    const result = { ...node };
    for (const k of Object.keys(result)) {
        const fullPath = path ? `${path}.${k}` : k;
        if (zeroKeys.has(fullPath)) {
            delete result[k];
            continue;
        }

        if (typeof result[k] === "object" && result[k] !== null) {
            result[k] = applyZeroKeyFilter(result[k], zeroKeys, fullPath);
            // Clean up empty objects resulting from deletion
            if (!Array.isArray(result[k]) && Object.keys(result[k]).length === 0) {
                delete result[k];
            }
        }
    }
    return result;
}

function transformEvent(data: any): any {
    const event = data?.Event;
    if (!event || typeof event !== 'object') return event || {};

    const summaryObj = { ...event };

    if (summaryObj.Timezone) {
        summaryObj.TimezoneSummary = summaryObj.Timezone.NameEn || summaryObj.Timezone.NameFr;
        delete summaryObj.Timezone;
    }

    if (summaryObj.OwnerPOS) {
        summaryObj.OwnerPOS_Summary = {
            ID: summaryObj.OwnerPOS.ID,
            Name: summaryObj.OwnerPOS.Name,
            Prefix: summaryObj.OwnerPOS.Prefix,
            Tax1Number: summaryObj.OwnerPOS.Tax1Number,
            Tax2Number: summaryObj.OwnerPOS.Tax2Number,
        };
        delete summaryObj.OwnerPOS;
    }

    if (summaryObj.RO_Producer) {
        summaryObj.Producer_Summary = {
            Name: summaryObj.RO_Producer.Name,
            Email: summaryObj.RO_Producer.Email
        };
        delete summaryObj.RO_Producer;
    }

    if (summaryObj.RO_RepresentationType) {
        summaryObj.RepresentationTypeSummary = summaryObj.RO_RepresentationType.NameEn || summaryObj.RO_RepresentationType.NameFr;
        delete summaryObj.RO_RepresentationType;
    }

    if (summaryObj.RO_DefaultSalesRevenueGLAccount) {
        summaryObj.SalesRevenueGLAccount_Summary = summaryObj.RO_DefaultSalesRevenueGLAccount.Description;
        delete summaryObj.RO_DefaultSalesRevenueGLAccount;
    }

    if (summaryObj.RO_DefaultRoyaltyGLAccount) {
        summaryObj.RoyaltyGLAccount_Summary = summaryObj.RO_DefaultRoyaltyGLAccount.Description;
        delete summaryObj.RO_DefaultRoyaltyGLAccount;
    }

    return summaryObj;
}

function transformEventDates(data: any): any {
    const datesData = data?.EventDates;
    if (!datesData) return {};

    let list: any[] = [];
    let isWrapper = false;

    if (Array.isArray(datesData)) {
        list = datesData;
    } else if (datesData.EventDateModelList && Array.isArray(datesData.EventDateModelList)) {
        list = datesData.EventDateModelList;
        isWrapper = true;
    } else if (datesData.EventDates && Array.isArray(datesData.EventDates)) {
        list = datesData.EventDates;
        isWrapper = true;
    } else {
        return datesData;
    }

    const summarizedList = list.map((ed: any) => {
        const summaryObj = { ...ed };

        if (summaryObj.Venue) {
            summaryObj.Venue_Summary = {
                ID: summaryObj.Venue.ID,
                Name: summaryObj.Venue.Name,
                DisplayName: summaryObj.Venue.DisplayName
            };
            delete summaryObj.Venue;
        }

        if (summaryObj.RO_EventTSTimeZone) {
            summaryObj.TimezoneSummary = summaryObj.RO_EventTSTimeZone.NameEn || summaryObj.RO_EventTSTimeZone.NameFr;
            delete summaryObj.RO_EventTSTimeZone;
        }

        summaryObj.Schedule = {
            EventDate: {
                UTC: summaryObj.Date,
                Local: summaryObj.RO_Date_Local
            },
            Sales_BoxOffice: {
                StartUTC: summaryObj.SalesStartDateBoxOffice,
                StartLocal: summaryObj.RO_SalesStartDateBoxOffice_Local,
                EndUTC: summaryObj.SalesEndDateBoxOffice,
                EndLocal: summaryObj.RO_SalesEndDateBoxOffice_Local
            },
            Sales_Internet: {
                StartUTC: summaryObj.SalesStartDateInternet,
                StartLocal: summaryObj.RO_SalesStartDateInternet_Local,
                EndUTC: summaryObj.SalesEndDateInternet,
                EndLocal: summaryObj.RO_SalesEndDateInternet_Local
            },
            Sales_Network: {
                StartUTC: summaryObj.SalesStartDateNetwork,
                StartLocal: summaryObj.RO_SalesStartDateNetwork_Local,
                EndUTC: summaryObj.SalesEndDateNetwork,
                EndLocal: summaryObj.RO_SalesEndDateNetwork_Local
            }
        };

        [
            "Date", "RO_Date_Local",
            "SalesStartDateBoxOffice", "RO_SalesStartDateBoxOffice_Local",
            "SalesEndDateBoxOffice", "RO_SalesEndDateBoxOffice_Local",
            "SalesStartDateInternet", "RO_SalesStartDateInternet_Local",
            "SalesEndDateInternet", "RO_SalesEndDateInternet_Local",
            "SalesStartDateNetwork", "RO_SalesStartDateNetwork_Local",
            "SalesEndDateNetwork", "RO_SalesEndDateNetwork_Local"
        ].forEach(k => delete summaryObj[k]);

        return summaryObj;
    });

    if (isWrapper) {
        const wrapper = { ...datesData };
        if (wrapper.EventDateModelList) wrapper.EventDateModelList = summarizedList;
        else if (wrapper.EventDates) wrapper.EventDates = summarizedList;
        return wrapper;
    }

    return summarizedList;
}

function transformFeeDefinitions(data: any): any {
    const feeData = data?.FeeDefinitions;
    if (!feeData) return {};

    let list: any[] = [];
    let isWrapper = false;

    if (Array.isArray(feeData)) {
        list = feeData;
    } else if (feeData.FeeDefinitionModelList && Array.isArray(feeData.FeeDefinitionModelList)) {
        list = feeData.FeeDefinitionModelList;
        isWrapper = true;
    } else if (feeData.FeeDefinitions && Array.isArray(feeData.FeeDefinitions)) {
        list = feeData.FeeDefinitions;
        isWrapper = true;
    } else {
        return feeData;
    }

    const summarizedList = list.map((fee: any) => {
        return { ...fee };
    });

    if (isWrapper) {
        const wrapper = { ...feeData };
        if (wrapper.FeeDefinitionModelList) wrapper.FeeDefinitionModelList = summarizedList;
        else if (wrapper.FeeDefinitions) wrapper.FeeDefinitions = summarizedList;
        return wrapper;
    }

    return summarizedList;
}

function transformOwnerPOS(data: any): any {
    const pos = data?.OwnerPOS;
    if (!pos || typeof pos !== "object") return pos || {};

    const summaryObj = { ...pos };

    // 1. Group Contact & Location
    summaryObj.ContactInfo = {
        Address: summaryObj.Address,
        City: summaryObj.City,
        Province: summaryObj.Province,
        PostalCode: summaryObj.PostalCode,
        Country: summaryObj.Country,
        Region: summaryObj.Region,
        Phone: summaryObj.Phone,
        BuyTicketPhone: summaryObj.BuyTicketPhone,
        Fax: summaryObj.Fax,
        Email: summaryObj.Email,
        Website: summaryObj.DisplayWebsite
    };
    [
        "Address", "City", "Province", "PostalCode", "Country", "Region",
        "Phone", "BuyTicketPhone", "Fax", "Email", "DisplayWebsite"
    ].forEach(k => delete summaryObj[k]);

    // 2. Group Accounting & GL Data
    const accountingKeys = [
        "AccountReceivableGLAccountID", "AccountPayableGLAccountID",
        "TaxDue1GLAccountID", "TaxDue2GLAccountID",
        "TaxReceivable1GLAccountID", "TaxReceivable2GLAccountID",
        "HandlingFeesGLAccountID", "PhoneFeesGLAccountID",
        "ServiceCharge1GLAccountID", "ServiceCharge2GLAccountID",
        "CommissionIncome1GLAccountID", "CommissionIncome2GLAccountID",
        "SalesRevenueGLAccountID", "BankGLAccountID", "RoyaltyGLAccountID",
        "ServiceCharge1IncomeFromPOSGLAccountID", "ServiceCharge2IncomeFromPOSGLAccountID",
        "ServiceCharge1IncomeInternalGLAccountID", "ServiceCharge2IncomeInternalGLAccountID",
        "ClientAccountPaymentModeGLAccountID", "ShippingManagementPointOfSaleID"
    ];

    const accountingConfigs: Record<string, any> = {};
    let hasAccounting = false;
    accountingKeys.forEach(k => {
        if (k in summaryObj) {
            accountingConfigs[k] = summaryObj[k];
            hasAccounting = true;
            delete summaryObj[k];
        }
    });
    if (hasAccounting) {
        summaryObj.AccountingConfigs = accountingConfigs;
    }

    // 3. Group Invoicing/Prefix
    summaryObj.InvoiceConfigs = {
        Prefix: summaryObj.Prefix,
        PrefixNumber: summaryObj.PrefixNumber,
        InvoiceNumber: summaryObj.InvoiceNumber,
        InvoiceFormat: summaryObj.InvoiceFormat,
        ReservationNumber: summaryObj.ReservationNumber,
        ReservationFormat: summaryObj.ReservationFormat
    };
    [
        "Prefix", "PrefixNumber", "InvoiceNumber", "InvoiceFormat",
        "ReservationNumber", "ReservationFormat"
    ].forEach(k => delete summaryObj[k]);

    return summaryObj;
}

function transformPriceGroups(data: any): any {
    const list = data?.PriceGroups;
    if (!Array.isArray(list)) return list || {};

    return list.map((pg: any) => {
        const summaryObj = { ...pg };

        // Condense AllowedPointOfSales array into a single summary string
        const allowedPos = pg.AllowedPointOfSales || pg.AllowedPointOfSalesModelList || [];
        if (Array.isArray(allowedPos) && allowedPos.length > 0) {
            const posLabels = new Set<string>();
            allowedPos.forEach((posEntry: any) => {
                const val = posEntry.PointOfSaleID;
                if (val) posLabels.add(extractPgLabel(val));
            });
            summaryObj.AllowedPointOfSales = Array.from(posLabels).sort().join(", ");
        } else {
            summaryObj.AllowedPointOfSales = "None";
        }
        delete summaryObj.AllowedPointOfSalesModelList;

        // Simplify timezone and fee objects if they exist
        if (summaryObj.RO_EventTSTimeZone) {
            summaryObj.TimezoneSummary = summaryObj.RO_EventTSTimeZone.NameEn || summaryObj.RO_EventTSTimeZone.NameFr;
            delete summaryObj.RO_EventTSTimeZone;
        }

        if (summaryObj.RO_FeeDefinition1) {
            if (summaryObj.ChargeFees1) {
                summaryObj.FeeDefinition1_Name = summaryObj.RO_FeeDefinition1.Name;
            }
            delete summaryObj.RO_FeeDefinition1;
        }

        if (summaryObj.RO_FeeDefinition2) {
            if (summaryObj.ChargeFees2) {
                summaryObj.FeeDefinition2_Name = summaryObj.RO_FeeDefinition2.Name;
            }
            delete summaryObj.RO_FeeDefinition2;
        }

        return summaryObj;
    });
}

function transformPrices(data: any): any {
    const list = data?.Prices;
    if (!Array.isArray(list)) return list || {};

    /** Helper to remove case-sensitive ID keys */
    function removeIDKeys(obj: any): any {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(removeIDKeys);

        const result: any = {};
        for (const [k, v] of Object.entries(obj)) {
            if (k.includes("ID")) continue;
            result[k] = removeIDKeys(v);
        }
        return result;
    }

    return list.map((priceDef: any) => {
        const summaryObj = { ...priceDef };

        // 1. Simplify MainPrice by summing the amounts
        if (summaryObj.MainPrice && summaryObj.MainPrice.Price) {
            const mp = summaryObj.MainPrice.Price;
            summaryObj.MainPrice_Summary = {
                Total: sumAmounts(mp.Price, mp.Tax1Amount, mp.Tax2Amount),
                RoyaltyTotal: sumAmounts(mp.Royalty, mp.RoyaltyTax1, mp.RoyaltyTax2),
            };

            const cleanedMainPrice = { ...summaryObj.MainPrice };
            const cleanedMp = { ...mp };
            [
                "Price", "Tax1Amount", "Tax2Amount", "Tax1Rate", "Tax2Rate",
                "Royalty", "RoyaltyTax1", "RoyaltyTax2"
            ].forEach(k => delete cleanedMp[k]);
            cleanedMainPrice.Price = cleanedMp;
            summaryObj.MainPrice = cleanedMainPrice;
        }

        // 2. Simplify nested Prices array (Section Prices)
        const sectionPrices = summaryObj.Prices || summaryObj.PricesModelList || [];
        if (Array.isArray(sectionPrices) && sectionPrices.length > 0) {
            summaryObj.SectionPrices_Summary = sectionPrices.map((sp: any) => {
                const cleanedSp = { ...sp };
                if (cleanedSp.Price) {
                    const p = cleanedSp.Price;
                    cleanedSp.Total = sumAmounts(p.Price, p.Tax1Amount, p.Tax2Amount);
                    cleanedSp.RoyaltyTotal = sumAmounts(p.Royalty, p.RoyaltyTax1, p.RoyaltyTax2);

                    const cleanedP = { ...p };
                    [
                        "Price", "Tax1Amount", "Tax2Amount", "Tax1Rate", "Tax2Rate",
                        "Royalty", "RoyaltyTax1", "RoyaltyTax2"
                    ].forEach(k => delete cleanedP[k]);
                    cleanedSp.Price = cleanedP;
                }
                return cleanedSp;
            });

            delete summaryObj.Prices;
            delete summaryObj.PricesModelList;
            summaryObj.Prices = summaryObj.SectionPrices_Summary;
            delete summaryObj.SectionPrices_Summary;
        }

        // 3. Apply the ID filter (case-sensitive) to the resulting object
        return removeIDKeys(summaryObj);
    });
}

function sumAmounts(...amounts: any[]): number {
    const total = amounts.reduce((acc, val) => {
        const num = parseFloat(val);
        return acc + (!isNaN(num) ? num : 0);
    }, 0);
    return Number(total.toFixed(4));
}

function extractPgLabel(value: string | number): string {
    const strVal = String(value);
    const match = strVal.match(/\((.+)\)$/);
    return match ? match[1] : strVal.trim();
}

function transformRightToSellAndFees(data: any): any {
    const list = data?.RightToSellAndFees;
    if (!Array.isArray(list)) return list || {};

    return list.map((right: any) => {
        const labels = new Set<string>();

        const pgList = right?.POSPriceGroups || right?.POSPriceGroupModelList || [];
        if (Array.isArray(pgList) && pgList.length > 0) {
            pgList.forEach((pg: any) => {
                const val = pg.EventPriceGroupID || pg.PriceGroupID;
                if (val) labels.add(extractPgLabel(val));
            });
        } else {
            // Recursive scan fallback just in case
            const scan = (node: any) => {
                if (!node || typeof node !== 'object') return;
                if (Array.isArray(node)) {
                    node.forEach(scan);
                } else {
                    for (const [k, v] of Object.entries(node)) {
                        if ((k === 'EventPriceGroupID' || k === 'PriceGroupID') && v) {
                            labels.add(extractPgLabel(v as string | number));
                        } else if (typeof v === 'object') {
                            scan(v);
                        }
                    }
                }
            };
            scan(right);
        }

        const sortedLabels = Array.from(labels).sort();

        const summaryObj = { ...right };
        delete summaryObj.POSPriceGroups;
        delete summaryObj.POSPriceGroupModelList;

        summaryObj.AllowedPriceGroups = sortedLabels.length > 0 ? sortedLabels.join(", ") : "None";

        if (summaryObj.EventPointOfSale) {
            const epos = summaryObj.EventPointOfSale;

            summaryObj.EventPosFee1_Summary = {
                Total: sumAmounts(epos.Fee1Amount, epos.Fee1Tax1Amount, epos.Fee1Tax2Amount),
                IncomeInternal: sumAmounts(epos.Fee1IncomeInternal, epos.Fee1IncomeInternalTax1, epos.Fee1IncomeInternalTax2),
                IncomeForPOS: sumAmounts(epos.Fee1IncomeForPOS, epos.Fee1IncomeForPOSTax1, epos.Fee1IncomeForPOSTax2),
            };

            summaryObj.EventPosFee2_Summary = {
                Total: sumAmounts(epos.Fee2Amount, epos.Fee2Tax1Amount, epos.Fee2Tax2Amount),
                IncomeInternal: sumAmounts(epos.Fee2IncomeInternal, epos.Fee2IncomeInternalTax1, epos.Fee2IncomeInternalTax2),
                IncomeForPOS: sumAmounts(epos.Fee2IncomeForPOS, epos.Fee2IncomeForPOSTax1, epos.Fee2IncomeForPOSTax2),
            };

            const cleanedEpos = { ...epos };
            [
                "Fee1Amount", "Fee1Tax1Amount", "Fee1Tax2Amount", "Fee1Tax1Rate", "Fee1Tax2Rate",
                "Fee1IncomeInternal", "Fee1IncomeInternalTax1", "Fee1IncomeInternalTax2",
                "Fee1IncomeForPOS", "Fee1IncomeForPOSTax1", "Fee1IncomeForPOSTax2",
                "Fee2Amount", "Fee2Tax1Amount", "Fee2Tax2Amount", "Fee2Tax1Rate", "Fee2Tax2Rate",
                "Fee2IncomeInternal", "Fee2IncomeInternalTax1", "Fee2IncomeInternalTax2",
                "Fee2IncomeForPOS", "Fee2IncomeForPOSTax1", "Fee2IncomeForPOSTax2"
            ].forEach(k => delete cleanedEpos[k]);

            summaryObj.EventPointOfSale = cleanedEpos;
        }

        const feeRights = summaryObj.RightToSellFees || summaryObj.RightToSellFeesModelList || [];
        if (Array.isArray(feeRights) && feeRights.length > 0) {
            summaryObj.RightToSellFees_Summary = feeRights.map((fee: any) => {
                const cleanedFee = { ...fee };
                [
                    "FeeAmount", "FeeTax1", "FeeTax2", "Tax1Rate", "Tax2Rate",
                    "IncomeInternal", "IncomeInternalTax1", "IncomeInternalTax2",
                    "IncomeForPOS", "IncomeForPOSTax1", "IncomeForPOSTax2"
                ].forEach(k => delete cleanedFee[k]);

                return {
                    ...cleanedFee,
                    FeeTotal: sumAmounts(fee.FeeAmount, fee.FeeTax1, fee.FeeTax2),
                    IncomeInternalTotal: sumAmounts(fee.IncomeInternal, fee.IncomeInternalTax1, fee.IncomeInternalTax2),
                    IncomeForPOSTotal: sumAmounts(fee.IncomeForPOS, fee.IncomeForPOSTax1, fee.IncomeForPOSTax2),
                };
            });
            delete summaryObj.RightToSellFees;
            delete summaryObj.RightToSellFeesModelList;
            summaryObj.RightToSellFees = summaryObj.RightToSellFees_Summary;
            delete summaryObj.RightToSellFees_Summary;
        }

        return summaryObj;
    });
}

function extractListFromModule(moduleData: any, listKeys: string[]): any {
    if (!moduleData || typeof moduleData !== 'object') return moduleData;
    for (const key of listKeys) {
        if (key in moduleData) return moduleData[key];
    }
    return moduleData;
}

export function transformReservatechEvent(data: any, references: any[] = []): any {
    // 1. Prepare Target and Reference data using Semantic Chunking logic
    const allEvents = [data, ...references];
    const transformedEvents = allEvents.map(e => {
        const resolved = resolveIds(e);

        if (resolved?.PriceGroups) {
            resolved.PriceGroups = extractListFromModule(resolved.PriceGroups, ["PriceGroupModelList", "PriceGroups"]);
        }
        if (resolved?.Prices) {
            resolved.Prices = extractListFromModule(resolved.Prices, ["EventPriceModelList", "Prices"]);
        }
        if (resolved?.RightToSellAndFees) {
            resolved.RightToSellAndFees = extractListFromModule(resolved.RightToSellAndFees, ["RightToSellAndFeesModelList"]);
        }

        return {
            Event: transformEvent(resolved),
            EventDates: transformEventDates(resolved),
            FeeDefinitions: transformFeeDefinitions(resolved),
            OwnerPOS: transformOwnerPOS(resolved),
            PriceGroups: transformPriceGroups(resolved),
            Prices: transformPrices(resolved),
            RightToSellAndFees: transformRightToSellAndFees(resolved),
        };
    });

    // 2. Deduce Universal Zero/Empty keys across Target + References for EACH module
    const modules: (keyof typeof transformedEvents[0])[] = [
        "Event", "EventDates", "FeeDefinitions", "OwnerPOS", "PriceGroups", "Prices", "RightToSellAndFees"
    ];

    const finalTarget = transformedEvents[0];
    const finalRefs = transformedEvents.slice(1);

    const filteredResult: any = {};

    modules.forEach(mod => {
        const allInstancesOfModule = transformedEvents.map(ev => ev[mod]);
        const zeroKeys = getUniversalZeroKeys(allInstancesOfModule);
        filteredResult[mod] = applyZeroKeyFilter(finalTarget[mod], zeroKeys);
    });

    // Note: We currently only return the transformed Target Event.
    // The references are filtered internally but the orchestrator handles them via prepareModuleData.
    // To ensure they are ALSO filtered when the strategy calls prepareModuleData later,
    // we would ideally need to return the filtered references too, or rely on the strategy logic.
    return filteredResult;
}
