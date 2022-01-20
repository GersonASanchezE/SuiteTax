/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_EC_ST_Sales_WHT_Lines_LBRY_V2.0.js          ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jan 17 2022  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

//
define([
  "N/url",
  "N/record",
  "N/runtime",
  "N/search",
  "N/log",
  "N/email",
  "N/format",
  "./../Latam_Library/LMRY_libSendingEmailsLBRY_V2.0",
], function (url, record, runtime, search, log, email, format, libraryMail) {
  var LMRY_script = "LatamReady - EC Withholding Tax Sales LBRY";

  // Department, Class and Location
  var FEATURE_DEPARMENTS = runtime.isFeatureInEffect({
    feature: "DEPARTMENTS",
  });
  var FEATURE_LOCATION = runtime.isFeatureInEffect({ feature: "LOCATIONS" });
  var FEATURE_CLASS = runtime.isFeatureInEffect({ feature: "CLASSES" });
  var ST_FEATURE =
    runtime.isFeatureInEffect({ feature: "tax_overhauling" }) || false;

  var FEATURE_SUBSIDIARY = runtime.isFeatureInEffect({
    feature: "SUBSIDIARIES",
  });
  var FEATURE_MULTIBOOK = runtime.isFeatureInEffect({ feature: "MULTIBOOK" });
  var FEATURE_JOBS = runtime.isFeatureInEffect({ feature: "FEATURE_JOBS" });

  var resultsNTbyWHT = {};
  var jsonGlobal = {};
  var jsonSetupTax = {};
  var jsonAnother = {};

  var scriptType = "";

  var count = 0;

  //activacion de Accounting Preferences
  var userObj = runtime.getCurrentUser();
  var prefDep = userObj.getPreference({ name: "DEPTMANDATORY" });
  var prefLoc = userObj.getPreference({ name: "LOCMANDATORY" });
  var prefClas = userObj.getPreference({ name: "CLASSMANDATORY" });

  function mapeo(currentTran, jsonAmounts, CONCEPT) {
    if (scriptType != "suitelet") {
      // TODO: Buscar informacion de los
      // National Taxes relacionados a la transacción
      resultsNTbyWHT = searchNTbyWHT(
        currentTran.getValue("subsidiary"),
        CONCEPT
      );
      log.debug("resultsNTbyWHT", resultsNTbyWHT);
      // TODO: BUSCAR DATOS DE RECORD: SETUP TAX SUBSIDIARY
      if (!Object.keys(jsonSetupTax).length) {
        _setupTaxSubsidiary(currentTran.getValue("subsidiary"));
      }
    } else {
      // TODO: SI ES SUITLET REALIZA EL SEARCH NT
      resultsNTbyWHT = searchNTbyWHT(
        currentTran.getValue("subsidiary"),
        CONCEPT
      );
    }
    // TODO: APLICAR NT Y CREAR OBJETO CON
    // TODA LA INFORMACION
    log.debug("resultsNTbyWHT", resultsNTbyWHT);
    logicaLlenado(resultsNTbyWHT, currentTran, jsonAmounts);
  }

  function logicaLlenado(resultsNTbyWHT, currentTran, jsonAmounts) {
    var grossInvoice = jsonAmounts["gross"];
    var taxInvoice = jsonAmounts["tax"];
    var netInvoice = jsonAmounts["net"];

    if (resultsNTbyWHT && resultsNTbyWHT.length) {
      for (var i = 0; i < resultsNTbyWHT.length; i++) {
        var internalidNT = resultsNTbyWHT[i].getValue({ name: "internalid" });
        var taxItem = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_taxitem",
        });
        var taxRate = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_taxrate",
        });
        var taxCode = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_taxcode",
        });
        var itmsubtype = resultsNTbyWHT[i].getValue({
          name: "subtype",
          join: "custrecord_lmry_ntax_taxitem",
        });
        var rDepartment = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_department",
        });
        var rDepartmentText = resultsNTbyWHT[i].getText({
          name: "custrecord_lmry_ntax_department",
        });
        var rClass = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_class",
        });
        var rClassText = resultsNTbyWHT[i].getText({
          name: "custrecord_lmry_ntax_class",
        });
        var rLocation = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_location",
        });
        var rLocationText = resultsNTbyWHT[i].getText({
          name: "custrecord_lmry_ntax_location",
        });
        var appliesTo = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_appliesto",
        });
        var amountTo = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_amount",
        });
        var amountToText = resultsNTbyWHT[i].getText({
          name: "custrecord_lmry_ntax_amount",
        });
        var minimum = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_minamount",
        });
        var rDescription = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_description",
        });
        var subType = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_sub_type",
        });
        var subTypeText = resultsNTbyWHT[i].getText({
          name: "custrecord_lmry_ntax_sub_type",
        });
        var ecTaxcode = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ec_ntax_wht_taxcode",
        });
        var taxType = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_taxtype",
        });
        var taxTypeText = resultsNTbyWHT[i].getText({
          name: "custrecord_lmry_ntax_taxtype",
        });
        var ecCatalog = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ec_ntax_catalog",
        });
        var ecCatalogText = resultsNTbyWHT[i].getText({
          name: "custrecord_lmry_ec_ntax_catalog",
        });
        var rateText = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_taxrate_pctge",
        });
        var generatedtransaction = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_gen_transaction",
        });
        var generatedtransactionText = resultsNTbyWHT[i].getText({
          name: "custrecord_lmry_ntax_gen_transaction",
        });
        var transactionTypes = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_transactiontypes",
        });
        var dateFrom = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_datefrom",
        });
        dateFrom = format.parse({ value: dateFrom, type: format.Type.DATE });
        var dateTo = resultsNTbyWHT[i].getValue({
          name: "custrecord_lmry_ntax_dateto",
        });
        dateTo = format.parse({ value: dateTo, type: format.Type.DATE });

        // var dateTransaction = currentTran.getValue({ name: "trandate" });
        var dateTransaction = format.parse({
          value: currentTran.getValue({ name: "trandate" }),
          type: format.Type.DATE,
        });

        var banderaNoRetention = false;

        // TODO: VALIDACION DEL TIPO DE TRANSACCION
        var jsonTransactionTypes = {
          custinvc: "1",
          custcred: "8",
          cashsale: "3",
        };
        var banderaTR = true;

        // from 1,8,3
        transactionTypes = transactionTypes.split(",");
        // to [1,4,6]
        log.debug("transactionTypes", transactionTypes);

        for (var j = 0; j < transactionTypes.length; j++) {
          var typeTR = currentTran.getValue({ name: "type" }).toLowerCase();
          log.debug(
            "jsonTransactionTypes[typeTR]",
            jsonTransactionTypes[typeTR]
          );
          log.debug("transactionTypes[j]", transactionTypes[j]);
          if (jsonTransactionTypes[typeTR] == transactionTypes[j]) {
            banderaTR = false;
            break;
          }
        }
        if (banderaTR) continue;
        // --------------------------------------------------

        // TODO: VALIDACION DE CABECERA O LINEAS
        // CABECERA: 1
        // LINEAS: 2
        if (appliesTo != "2") continue;

        // TODO: VALIDACION DE FECHA DE TRANSACCION
        if (!(dateTo >= dateTransaction && dateFrom <= dateTransaction)) {
          // if (false) {
          log.debug("Fecha Invalida", {
            dateTo: dateTo,
            dateTransaction: dateTransaction,
            dateFrom: dateFrom,
          });
          continue;
        } else {
          log.debug("Fecha Valida", {
            MENOR: dateTo >= dateTransaction,
            MAYOR: dateFrom <= dateTransaction,
          });
        }

        // TODO: VALIDAR CATALOGO // OPCIONAL
        if (jsonAmounts["catalog"] != ecCatalog) continue;

        // TODO: VALIDACION DE SUBTYPE DE ITEM
        // VALIDAD SI EL ARTICULO ES PARA VENTAS
        var itemTypes = [
          "Para la venta",
          "For Sale",
          "Para reventa",
          "For Resale",
          "Para revenda",
          "Para venda",
        ];
        if (itemTypes.indexOf(itmsubtype) == -1) continue;

        // TODO: VALIDACION DE TAXCODE
        if (!taxCode) continue;

        // TODO: SI NO SE ESTABLECIO MONTO MINIMO ES 0 POR DEFECTO
        if (minimum == null || minimum == "" || minimum < 0) {
          minimum = 0;
        }

        minimum = parseFloat(minimum);

        var amountBase = 0;

        switch (amountTo) {
          // 1: GROSS AMOUNT IN NT
          case "1":
            amountBase = grossInvoice;
            break;
          case "2":
            amountBase = taxInvoice;
            break;
          case "3":
            amountBase = netInvoice;
            break;
        }

        if (!parseFloat(amountBase) > 0) continue;

        // TODO: VALIDACION DE MONTO MINIMO FIELD => OPCIONAL
        if (!(parseFloat(amountBase) > parseFloat(minimum))) continue;

        // 55642.23233 to 55642.23
        amountBase = parseFloat(Math.round(parseFloat(amountBase) * 100) / 100);

        // 34.4545
        var retencion = parseFloat(amountBase) * parseFloat(taxRate);

        // 34.45554545 to 34.4556
        var retencion4 = parseFloat(
          Math.round(parseFloat(retencion) * 10000) / 10000
        );
        // 34.455454545 to 34.45
        var whtamount = parseFloat(
          Math.round(parseFloat(retencion) * 100) / 100
        );
        retencion = parseFloat(Math.round(parseFloat(retencion) * 100) / 100);

        count++;

        var idTransaction = currentTran.getValue("internalid");

        log.debug("datosRet", {
          idTransaction: idTransaction,
          retencion: retencion,
          retencion4: retencion4,
          amountBase: amountBase,
          taxRate: taxRate,
          taxCode: taxCode,
        });

        // TODO: RETENCION // MANUAL Y NO RETENTION
        if (jsonAnother) {
          var manual = JSON.parse(jsonAnother["manual"]);
          var noRetention = JSON.parse(jsonAnother["noretention"]);

          if (manual[idTransaction] && manual[idTransaction][count]) {
            amountBase = manual[idTransaction][count]["base"];
            retencion = manual[idTransaction][count]["amount"];
            retencion4 = manual[idTransaction][count]["amount"];
          }

          if (noRetention[idTransaction]) {
            for (var j = 0; j < noRetention[idTransaction].length; j++) {
              if (noRetention[idTransaction][j] == count) {
                banderaNoRetention = true;
                continue;
              }
            }
          }

          if (banderaNoRetention) {
            continue;
          }
        }

        // TODO: VALIDAR QUE ESTE APILANDO LA INFORMACION EN SOLO
        // 1 TRANSACCIÓN
        if (!jsonGlobal[idTransaction]) {
          jsonGlobal[idTransaction] = {
            tranid: currentTran.getValue({
              name: "tranid",
            }),
            entityvalue: currentTran.getValue({ name: "entity" }),
            entitytext: currentTran.getText({ name: "entity" }),
            date: dateTransaction,
            dateParsed: format.parse({
              value: currentTran.getValue({ name: "trandate" }),
              type: format.Type.DATE,
            }),
            country: currentTran.getValue({
              name: "custbody_lmry_subsidiary_country",
            }),
            type: currentTran.getValue({ name: "type" }).toLowerCase(),
            typetext: currentTran.getText({ name: "type" }),
            periodtext: currentTran.getText({ name: "postingperiod" }),
            periodvalue: currentTran.getValue({ name: "postingperiod" }),
            subsidiary: currentTran.getValue({ name: "subsidiary" }),
            rate: currentTran.getValue({ name: "exchangerate" }),
            currency: currentTran.getValue({ name: "currency" }),
            account: currentTran.getValue({ name: "account" }),
            authorization: currentTran.getValue({
              name: "custbody_lmry_ec_wht_authorization",
            }),
            taxnumber: currentTran.getValue({
              name: "custbody_lmry_preimpreso_retencion",
            }),
            serie: currentTran.getValue({
              name: "custbody_lmry_serie_doc_cxc",
            }),
            document: currentTran.getValue({
              name: "custbody_lmry_document_type",
            }),
          };

          jsonGlobal[idTransaction]["wht"] = [];
        }

        // TODO: SI NO SE USAN LOS CAMPOS DE SEGMENTACION DE SUITELET SE USARAN LOS DE LA 
        // TRANSACCION ORIGINAL
        if (jsonAnother) {
          jsonGlobal[idTransaction]["department"] =
            jsonAnother["department"] ||
            (FEATURE_DEPARMENTS
              ? currentTran.getValue({ name: "department" })
              : "");
          jsonGlobal[idTransaction]["class"] =
            jsonAnother["class"] ||
            (FEATURE_CLASS ? currentTran.getValue({ name: "class" }) : "");
          jsonGlobal[idTransaction]["location"] =
            jsonAnother["location"] ||
            (FEATURE_LOCATION
              ? currentTran.getValue({ name: "location" })
              : "");

          var whtValues = JSON.parse(jsonAnother["whtValues"]);

          if (whtValues[idTransaction]) {
            jsonGlobal[idTransaction]["date"] =
              whtValues[idTransaction]["date"];
            jsonGlobal[idTransaction]["formatdate"] =
              whtValues[idTransaction]["formatDate"];
            jsonGlobal[idTransaction]["parsedate"] =
              whtValues[idTransaction]["parseDate"];
            jsonGlobal[idTransaction]["period"] =
              whtValues[idTransaction]["period"];
            jsonGlobal[idTransaction]["authorization"] =
              whtValues[idTransaction]["authorization"];
            jsonGlobal[idTransaction]["taxnumber"] =
              whtValues[idTransaction]["taxnumber"];
            jsonGlobal[idTransaction]["serie"] =
              Number(whtValues[idTransaction]["serie"]) || "";
          }
        }

        // TODO: AÑADIR TODA LA DATA DE APLICACION DE LOS NT
        // A LA TRANSACCION
        jsonGlobal[idTransaction]["wht"].push({
          amountToText: amountToText,
          base: amountBase,
          baseamount: amountBase,
          catalog: ecCatalog,
          catalogText: ecCatalogText,
          class: rClass,
          classText: rClassText,
          department: rDepartment,
          departmentText: rDepartmentText,
          description: rDescription,
          generatedtransaction: generatedtransaction,
          generatedtransactionText: generatedtransactionText,
          gross: netInvoice,
          item: taxItem,
          itemtext: jsonAmounts["itemtext"],
          itemvalue: jsonAmounts["item"],
          line: jsonAmounts["line"],
          lineuniquekey: jsonAmounts["lineuniquekey"],
          location: rLocation,
          locationText: rLocationText,
          nationalTax: internalidNT,
          nt: internalidNT,
          percent: taxRate,
          ratetext: rateText,
          rete: subType,
          retencion: retencion,
          retencion4: retencion4,
          retetext: subTypeText,
          subtype: subType,
          subtypeText: subTypeText,
          taxcode: taxCode,
          taxtype: taxType,
          taxtypeText: taxTypeText,
          whtamount: whtamount,
          whtrate: taxRate,
        });
      }
    }
  }

  function _createTransaction() {
    try {
      var jsonMultibooking = {};

      var jsonTypes = {
        custinvc: "invoice",
        invoice: "creditmemo",
        cashsale: "cashrefund",
        custcred: "creditmemo",
        creditmemo: "invoice",
      };

      var idNewInvoices = [];
      log.debug("jsonGlobal", jsonGlobal);
      for (var idTransactionJG in jsonGlobal) {
        // CREAR JSON PARA MULTIBOOKING
        jsonMultibooking[idTransactionJG] = { books: "", basecurrency: 1 };
        var type = jsonGlobal[idTransactionJG]["type"];

        // TODO: ESTABLECER EL TIPO BASE : INVOICE, CASH SALE, CREDIT MEMO
        var fromType = type == "cashsale" ? type : jsonTypes[type];

        log.debug("fromType", fromType);

        // TODO: ESTABLECER EL TIPO AL QUE SERA CONVERTIVO
        // IF INVOICE THEN CREDIT MEMO
        // IF CREDIT MEMO THEN INVOICE
        var toType =
          type == "cashsale" ? jsonTypes[type] : jsonTypes[jsonTypes[type]];

        log.debug("jsonTypes[type]2", jsonTypes[type]);
        log.debug("toType", toType);

        // TODO: SI ES DE TIPO CASH SALE
        if (type == "cashsale") {
          var objRetencion = record.transform({
            fromType: fromType,
            fromId: idTransactionJG,
            // TO CASH REFUND
            toType: toType,
            isDynamic: false,
          });
        } else {
          // TODO: EMPEZAR A CREAR EL RECORD
          var objRetencion = record.create({ type: toType });
        }

        // TODO: ESTABLECER EL TIPO DE FORMULARIO
        // ESPECIFICADO EN EN SETUP TAX SUBSIDIARY
        if (jsonSetupTax[toType]) {
          objRetencion.setValue("customform", jsonSetupTax[toType]);
        }

        // TODO: PARA TODO TIPO MENOS CASH SALE
        if (type != "cashsale") {
          if (FEATURE_SUBSIDIARY) {
            objRetencion.setValue({
              fieldId: "subsidiary",
              value: jsonGlobal[idTransactionJG]["subsidiary"],
            });
          }
          objRetencion.setValue({
            fieldId: "entity",
            value: jsonGlobal[idTransactionJG]["entityvalue"],
          });

          // TODO: VALIDAR FEATURE DE JOBS
          if (FEATURE_JOBS) {
            var objOriginal = record.load({
              type: fromType,
              id: idTransactionJG,
            });
            objOriginal = objOriginal.getValue({
              name: "job",
            });
            if (objOriginal) {
              objRetencion.setValue({ fieldId: "job", value: objOriginal });
            }
          }
        }

        objRetencion.setValue({
          fieldId: "currency",
          value: jsonGlobal[idTransactionJG]["currency"],
        });
        objRetencion.setValue({
          fieldId: "account",
          value: jsonGlobal[idTransactionJG]["account"],
        });
        objRetencion.setValue({
          fieldId: "exchangerate",
          value: jsonGlobal[idTransactionJG]["rate"],
        });

        // TODO: SI ES MAP REDUCE
        if (scriptType == "mapreduce" && jsonAnother) {
          objRetencion.setValue({
            fieldId: "trandate",
            value: format.parse({
              value: jsonGlobal[idTransactionJG]["formatdate"],
              type: format.Type.DATE,
            }),
          });
          objRetencion.setValue({
            fieldId: "postingperiod",
            value: jsonGlobal[idTransactionJG]["period"],
          });
        } else {
          objRetencion.setValue({
            fieldId: "trandate",
            value: format.parse({
              value: jsonGlobal[idTransactionJG]["date"],
              type: format.Type.DATE,
            }),
          });
          objRetencion.setValue({
            fieldId: "postingperiod",
            value: jsonGlobal[idTransactionJG]["periodvalue"],
          });
        }

        //objRetencion.setValue({fieldId: 'postingperiod', value: jsonGlobal[i]['periodvalue']});
        objRetencion.setValue({
          fieldId: "memo",
          value: "Latam - EC WHT Sales by Lines",
        });

        objRetencion.setValue({
          fieldId: "custbody_lmry_apply_wht_code",
          value: true,
        });

        // TODO: SI ES TYPE CASHSALE
        if (type == "cashsale") {
          cleanCashRefundField(objRetencion);
        }

        // TODO: SI TIENE DEPARMENT
        if (jsonGlobal[idTransactionJG]["department"]) {
          objRetencion.setValue({
            fieldId: "department",
            value: jsonGlobal[idTransactionJG]["department"],
          });
        }

        // TODO: SI TIENE CLASS
        if (jsonGlobal[idTransactionJG]["class"]) {
          objRetencion.setValue({
            fieldId: "class",
            value: jsonGlobal[idTransactionJG]["class"],
          });
        }

        // TODO: SI TIENE LOCATION
        if (jsonGlobal[idTransactionJG]["location"]) {
          objRetencion.setValue({
            fieldId: "location",
            value: jsonGlobal[idTransactionJG]["location"],
          });
        }
        objRetencion.setValue({
          fieldId: "approvalstatus",
          value: "2",
        });
        // Relacionarlo con la transaccion original
        objRetencion.setValue({
          fieldId: "custbody_lmry_reference_transaction",
          value: idTransactionJG,
        });
        objRetencion.setValue({
          fieldId: "custbody_lmry_reference_transaction_id",
          value: idTransactionJG,
        });

        // TODO: SI ES TYPE CASHSALE
        if (type == "cashsale") {
          var cLineas = objRetencion.getLineCount({ sublistId: "item" });
          for (var j = 0; j < cLineas; j++) {
            objRetencion.removeLine({
              sublistId: "item",
              line: cLineas - j - 1,
            });
          }
        }

        var amount = 0;

        for (var j = 0; j < jsonGlobal[idTransactionJG]["wht"].length; j++) {
          objRetencion.setSublistValue({
            sublistId: "item",
            fieldId: "item",
            line: j,
            value: jsonGlobal[idTransactionJG]["wht"][j]["item"],
          });
          objRetencion.setSublistValue({
            sublistId: "item",
            fieldId: "description",
            line: j,
            value: jsonGlobal[idTransactionJG]["wht"][j]["retetext"],
          });
          objRetencion.setSublistValue({
            sublistId: "item",
            fieldId: "quantity",
            line: j,
            value: 1,
          });
          objRetencion.setSublistValue({
            sublistId: "item",
            fieldId: "price",
            line: j,
            value: -1,
          });
          objRetencion.setSublistValue({
            sublistId: "item",
            fieldId: "rate",
            line: j,
            value: jsonGlobal[idTransactionJG]["wht"][j]["retencion"],
          });
          objRetencion.setSublistValue({
            sublistId: "item",
            fieldId: "taxcode",
            line: j,
            value: jsonGlobal[idTransactionJG]["wht"][j]["taxcode"],
          });

          if (jsonGlobal[idTransactionJG]["department"]) {
            objRetencion.setSublistValue({
              sublistId: "item",
              fieldId: "department",
              line: j,
              value: jsonGlobal[idTransactionJG]["department"],
            });
          }
          if (jsonGlobal[idTransactionJG]["class"]) {
            objRetencion.setSublistValue({
              sublistId: "item",
              fieldId: "class",
              line: j,
              value: jsonGlobal[idTransactionJG]["class"],
            });
          }
          if (jsonGlobal[idTransactionJG]["location"]) {
            objRetencion.setSublistValue({
              sublistId: "item",
              fieldId: "location",
              line: j,
              value: jsonGlobal[idTransactionJG]["location"],
            });
          }

          amount += parseFloat(
            jsonGlobal[idTransactionJG]["wht"][j]["retencion"]
          );
        }

        log.debug("objRetencion", objRetencion);
        log.debug("amount", amount);
        var idNewTransaction = objRetencion.save({
          ignoreMandatoryFields: true,
          disableTriggers: true,
        });

        _sleep(2000);

        // TODO: APLICAR CREDIT MEMO ORIGINAL AL INVOICE CREADO
        if (fromType == "invoice") {
          _applyTransaction(toType, idNewTransaction, idTransactionJG);
        } else if (fromType == "creditmemo") {
          _applyTransaction(fromType, idTransactionJG, idNewTransaction);
        }

        _sleep(2000);

        // TODO: CARGAR TRANSACCION CREADA
        var loadNewTransaction = record.load({
          type: toType,
          id: idNewTransaction,
          isDynamic: true,
        });

        //TODO: MULTIBOOKING
        var idBooks = "0";
        var rateBooks = "1";
        if (FEATURE_MULTIBOOK) {
          var cBooks = loadNewTransaction.getLineCount({
            sublistId: "accountingbookdetail",
          });
          log.debug("cBooks", cBooks);
          if (cBooks > 0) {
            for (var j = 0; j < cBooks; j++) {
              loadNewTransaction.selectLine({
                sublistId: "accountingbookdetail",
                line: j,
              });
              var idBook = loadNewTransaction.getCurrentSublistValue({
                sublistId: "accountingbookdetail",
                fieldId: "bookid",
              });
              var rateBook = loadNewTransaction.getCurrentSublistValue({
                sublistId: "accountingbookdetail",
                fieldId: "exchangerate",
              });
              var currency = loadNewTransaction.getCurrentSublistValue({
                sublistId: "accountingbookdetail",
                fieldId: "currency",
              });

              log.debug("DATAMBOOK", {
                idBook: idBook,
                rateBook: rateBook,
                currency: currency,
                jsonSetupTax: jsonSetupTax["currency"],
              });
              // TODO: SI EL CURRENCY DEL MULTIBOOK
              // ES IGUAL AL CURRENCY DE SETUP TAX SUBSIDIARY
              if (currency == jsonSetupTax["currency"]) {
                jsonMultibooking[idTransactionJG]["basecurrency"] = rateBook;
                log.debug(
                  "[idTransactionJG]['basecurrency']",
                  jsonMultibooking[idTransactionJG]["basecurrency"]
                );
              }

              idBooks += "|" + idBook;
              rateBooks += "|" + rateBook;
            }
          }
        }
        idBooks += "&" + rateBooks;

        jsonMultibooking[idTransactionJG]["books"] = idBooks;

        loadNewTransaction.save({
          ignoreMandatoryFields: true,
          disableTriggers: true,
        });

        // TODO: MAP REDUCE
        // ACTUALIZACION TRANSACCION ORIGINAL
        if (scriptType == "mapreduce" && jsonAnother) {
          var valuesSubmit = {
            custbody_lmry_ec_wht_authorization:
              jsonGlobal[idTransactionJG]["authorization"],
            custbody_lmry_preimpreso_retencion:
              jsonGlobal[idTransactionJG]["taxnumber"],
          };

          if (jsonGlobal[idTransactionJG]["document"]) {
            valuesSubmit["custbody_lmry_serie_doc_cxc"] =
              jsonGlobal[idTransactionJG]["serie"];
          }

          record.submitFields({
            type: fromType,
            id: idTransactionJG,
            values: valuesSubmit,
            options: { disableTriggers: true, ignoreMandatoryFields: true },
          });
        }
        break;
      }

      log.debug("jsonMultibooking", jsonMultibooking);
      return jsonMultibooking;
    } catch (error) {
      log.error("_createTransaction", error);
    }
  }

  // TODO: CREATE TAX RESULT
  function _createWhtResult(jsonBooks) {
    try {
      var whtResult = [];
      for (var idTranJG in jsonGlobal) {
        for (var j = 0; j < jsonGlobal[idTranJG]["wht"].length; j++) {
          whtResult.push({
            taxtype: {
              text: jsonGlobal[idTranJG]["wht"][j]["taxtypeText"],
              value: jsonGlobal[idTranJG]["wht"][j]["taxtype"],
            },
            subtype: {
              text: jsonGlobal[idTranJG]["wht"][j]["subtypeText"],
              value: jsonGlobal[idTranJG]["wht"][j]["subtype"],
            },
            lineuniquekey: jsonGlobal[idTranJG]["wht"][j]["lineuniquekey"],
            catalog: {
              text: jsonGlobal[idTranJG]["wht"][j]["catalogText"],
              value: jsonGlobal[idTranJG]["wht"][j]["catalog"],
            },
            baseamount: jsonGlobal[idTranJG]["wht"][j]["baseamount"],
            whtamount: jsonGlobal[idTranJG]["wht"][j]["whtamount"],
            whtrate: jsonGlobal[idTranJG]["wht"][j]["whtrate"],
            contributoryClass: "",
            nationalTax: jsonGlobal[idTranJG]["wht"][j]["nationalTax"],
            debitaccount: "",
            creditaccount: "",
            generatedtransaction: {
              text: jsonGlobal[idTranJG]["wht"][j]["generatedtransactionText"],
              value: jsonGlobal[idTranJG]["wht"][j]["generatedtransaction"],
            },
            department: {
              text: jsonGlobal[idTranJG]["wht"][j]["departmentText"],
              value: jsonGlobal[idTranJG]["wht"][j]["department"],
            },
            class: {
              text: jsonGlobal[idTranJG]["wht"][j]["classText"],
              value: jsonGlobal[idTranJG]["wht"][j]["class"],
            },
            location: {
              text: jsonGlobal[idTranJG]["wht"][j]["locationText"],
              value: jsonGlobal[idTranJG]["wht"][j]["location"],
            },
            item: {
              text: jsonGlobal[idTranJG]["wht"][j]["itemtext"],
              value: jsonGlobal[idTranJG]["wht"][j]["itemvalue"],
            },
            expenseacc: {},
            position: j,
            description: jsonGlobal[idTranJG]["wht"][j]["description"],
            lc_baseamount: parseFloat(
              jsonGlobal[idTranJG]["wht"][j]["baseamount"] *
                jsonBooks[idTranJG]["basecurrency"]
            ),
            lc_whtamount: parseFloat(
              jsonGlobal[idTranJG]["wht"][j]["whtamount"] *
                jsonBooks[idTranJG]["basecurrency"]
            ),
          });
        }
        _saveWhtResult(
          idTranJG,
          jsonGlobal[idTranJG].subsidiary,
          jsonGlobal[idTranJG].country,
          jsonGlobal[idTranJG].dateParsed,
          whtResult
        );
        whtResult = [];
      }
    } catch (error) {
      log.error("_createWhtResult", error);
    }
  }

  function _saveWhtResult(
    idTranJG,
    subsidiary,
    countryID,
    tranDate,
    whtResult
  ) {
    // Result
    try {
      var whtResultSearch = search
        .create({
          // Actual
          type: "customrecord_lmry_ste_json_result",
          columns: ["internalid"],
          filters: [
            ["custrecord_lmry_ste_related_transaction", "IS", idTranJG],
          ],
        })
        .run()
        .getRange(0, 10);

      log.debug("whtResultSearch", whtResultSearch);
      log.debug("_saveWhtResult", whtResult);
      log.debug("DATESRECORD", {
        tranDate: tranDate,
        Subsidiary: subsidiary,
        Country: countryID,
        IdTranJG: idTranJG,
      });
      if (whtResultSearch !== null && whtResultSearch.length > 0) {
        var whtResultID = whtResultSearch[0].getValue({ name: "internalid" });
        record.submitFields({
          type: "customrecord_lmry_ste_json_result",
          id: whtResultID,
          values: {
            custrecord_lmry_ste_wht_transaction: JSON.stringify(whtResult),
          },
          options: {
            enableSourcing: false,
            ignoreMandatoryFields: true,
          },
        });
      } else {
        var WHT_Record = record.create({
          type: "customrecord_lmry_ste_json_result",
          isDynamic: false,
        });
        WHT_Record.setValue({
          fieldId: "custrecord_lmry_ste_related_transaction",
          value: idTranJG,
        });
        WHT_Record.setValue({
          fieldId: "custrecord_lmry_ste_subsidiary",
          value: subsidiary,
        });
        WHT_Record.setValue({
          fieldId: "custrecord_lmry_ste_subsidiary_country",
          value: countryID,
        });
        WHT_Record.setValue({
          fieldId: "custrecord_lmry_ste_transaction_date",
          value: tranDate,
        });
        WHT_Record.setValue({
          fieldId: "custrecord_lmry_ste_wht_transaction",
          value: JSON.stringify(whtResult),
        });

        var recordSave = WHT_Record.save({
          enableSourcing: true,
          ignoreMandatoryFields: true,
          disableTriggers: true,
        });
      }
    } catch (error) {
      log.error("_saveWhtResult", error);
    }
  }

  /**
   * @param {String} typeTransaction : ToType
   * @param {String} IdNewTransaction : IdNewTransaction
   * @param {String} IdTransactionJG : IdTransactionJG
   */
  function _applyTransaction(
    typeTransaction,
    IdNewTransaction,
    IdTransactionJG
  ) {
    try {
      var loadTransaction = record.load({
        type: typeTransaction,
        id: IdNewTransaction,
        isDynamic: true,
      });

      var cApply = loadTransaction.getLineCount({ sublistId: "apply" });

      for (var k = 0; k < cApply; k++) {
        loadTransaction.selectLine({ sublistId: "apply", line: k });

        var idTransaction = loadTransaction.getCurrentSublistValue({
          sublistId: "apply",
          fieldId: "doc",
        });

        if (idTransaction == IdTransactionJG) {
          loadTransaction.setCurrentSublistValue({
            sublistId: "apply",
            fieldId: "apply",
            value: true,
          });
          //loadTransaction.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'amount', value: amount });
          break;
        }
      }
      loadTransaction.save({
        disableTriggers: true,
        ignoreMandatoryFields: true,
      });
    } catch (error) {
      log.error("_applyTransaction", error);
    }
  }

  function afterSubmitTransaction(transactions, tipoDeScript, jsonLog) {
    try {
      if (typeof transactions == "object") {
        transactions = Object.keys(transactions);
      }

      scriptType = tipoDeScript;
      jsonAnother = jsonLog;

      var transactionsResult = _getTransactions(transactions);

      log.debug("transaction Result", transactionsResult);
      if (transactionsResult && transactionsResult.length) {
        for (var l = 0; l < transactionsResult.length; l++) {
          var idTransaction = transactionsResult[l].getValue("internalid");
          var NationalIVA =
            transactionsResult[l].getValue({
              name: "custrecord_lmry_ec_rte_iva",
              join: "CUSTRECORD_LMRY_EC_RELATED_TRANSACTION",
            }) || "@NONE@";
          var NationalFTE =
            transactionsResult[l].getValue({
              name: "custrecord_lmry_ec_rte_fte",
              join: "CUSTRECORD_LMRY_EC_RELATED_TRANSACTION",
            }) || "@NONE@";
          var grossAmount = transactionsResult[l].getValue({
            name: "custrecord_lmry_ec_gross_amount",
            join: "CUSTRECORD_LMRY_EC_RELATED_TRANSACTION",
          });
          var taxAmount =
            transactionsResult[l].getValue({
              name: "custrecord_lmry_ec_tax_amount",
              join: "CUSTRECORD_LMRY_EC_RELATED_TRANSACTION",
            }) || 0;
          var netAmount = transactionsResult[l].getValue({
            name: "custrecord_lmry_ec_net_amount",
            join: "CUSTRECORD_LMRY_EC_RELATED_TRANSACTION",
          });
          var linesAmount = transactionsResult[l].getValue({
            name: "custrecord_lmry_ec_lines_amount",
            join: "CUSTRECORD_LMRY_EC_RELATED_TRANSACTION",
          });

          linesAmount = JSON.parse(linesAmount);

          var cantidadItems = Object.keys(linesAmount).length;

          for (var m in linesAmount) {
            // SOLO SI ESTA ACTIVO Y EXISTE UN CONCEPTO
            if (linesAmount[m]["applywht"] && linesAmount[m]["catalog"]) {
              var grossLine = linesAmount[m]["gross"];
              var taxLine = linesAmount[m]["tax"];
              var netLine = linesAmount[m]["net"];

              //DESCUENTO
              if (
                parseInt(m) + 1 < cantidadItems &&
                !linesAmount[parseInt(m) + 1]["taxline"] &&
                parseFloat(linesAmount[parseInt(m) + 1]["gross"]) < 0
              ) {
                grossLine += round2(linesAmount[parseInt(m) + 1]["gross"]);
                taxLine += round2(linesAmount[parseInt(m) + 1]["tax"]);
                netLine += round2(linesAmount[parseInt(m) + 1]["net"]);
              }
              mapeo(
                transactionsResult[l],
                {
                  gross: round2(grossLine),
                  tax: round2(taxLine),
                  net: round2(netLine),
                  catalog: linesAmount[m]["catalog"],
                  line: m,
                  lineuniquekey: linesAmount[m]["lineuniquekey"],
                  item: linesAmount[m]["item"],
                  itemtext: linesAmount[m]["itemtext"],
                },
                {
                  NT_CONCEPT_RET: linesAmount[m]["catalog"],
                }
              );
            }
          }
          count = 0;
        }
      }

      // TODO: SI ES MAP REDUCE O SI ES POR EC TRANSACTION FIELDS
      if (scriptType != "suitelet") {
        var jsonBooks = _createTransaction();
        _createWhtResult(jsonBooks);

        jsonGlobal = {};
      }
      return jsonGlobal;
    } catch (error) {
      log.error("afterSubmitTransaction", error);
    }
  }

  function _setupTaxSubsidiary(subsidiaria) {
    try {
      var ST_Filters = [
        search.createFilter({
          name: "isinactive",
          operator: "is",
          values: "F",
        }),
      ];

      if (FEATURE_SUBSIDIARY) {
        ST_Filters.push(
          search.createFilter({
            name: "custrecord_lmry_setuptax_subsidiary",
            operator: "is",
            values: subsidiaria,
          })
        );
      }

      var ST_Columns = [
        search.createColumn({
          name: "custrecord_lmry_setuptax_currency",
        }),
        search.createColumn({
          name: "custrecord_lmry_setuptax_form_creditmemo",
        }),
        search.createColumn({
          name: "custrecord_lmry_setuptax_form_cashrefund",
        }),
      ];

      var searchSetupTax = search.create({
        type: "customrecord_lmry_setup_tax_subsidiary",
        filters: ST_Filters,
        columns: ST_Columns,
      });

      searchSetupTax = searchSetupTax.run().getRange(0, 1);
      log.debug("searchSetupTax", searchSetupTax);
      if (searchSetupTax && searchSetupTax.length) {
        jsonSetupTax = {
          currency: searchSetupTax[0].getValue({
            name: "custrecord_lmry_setuptax_currency",
          }),
          creditmemo: searchSetupTax[0].getValue({
            name: "custrecord_lmry_setuptax_form_creditmemo",
          }),
          cashrefund: searchSetupTax[0].getValue({
            name: "custrecord_lmry_setuptax_form_cashrefund",
          }),
          invoice: searchSetupTax[0].getValue({
            name: "custrecord_lmry_setuptax_form_invoice",
          }),
        };
      }
      log.debug("jsonSetupTax", jsonSetupTax);
    } catch (error) {
      log.error("_setupTaxSubsidiary", error);
    }
  }

  function createSubList(subTabla, jsonLanguage, Language) {
    subTabla.addField({
      id: "sub_apply",
      label: jsonLanguage["apply"][Language],
      type: "checkbox",
    }).defaultValue = "T";
    subTabla.addField({
      id: "sub_count",
      label: jsonLanguage["count"][Language],
      type: "text",
    });
    subTabla.addField({
      id: "sub_type",
      label: jsonLanguage["type"][Language],
      type: "text",
    });
    subTabla
      .addField({
        id: "sub_type_hidden",
        label: jsonLanguage["type"][Language],
        type: "text",
      })
      .updateDisplayType({ displayType: "hidden" });
    subTabla.addField({
      id: "sub_id",
      label: jsonLanguage["internalid"][Language],
      type: "text",
    });
    subTabla
      .addField({
        id: "sub_id_hidden",
        label: jsonLanguage["internalid"][Language],
        type: "text",
      })
      .updateDisplayType({ displayType: "hidden" });
    subTabla.addField({
      id: "sub_transa",
      label: jsonLanguage["tranid"][Language],
      type: "text",
    });
    subTabla.addField({
      id: "sub_cust",
      label: jsonLanguage["customer"][Language],
      type: "text",
    });
    subTabla
      .addField({
        id: "sub_date",
        label: jsonLanguage["date"][Language],
        type: "date",
      })
      .updateDisplayType({ displayType: "entry" });
    subTabla
      .addField({
        id: "custpage_sub_period",
        label: jsonLanguage["period"][Language],
        type: "select",
      })
      .updateDisplayType({ displayType: "entry" });
    subTabla
      .addField({
        id: "sub_period",
        label: jsonLanguage["period"][Language],
        type: "text",
      })
      .updateDisplayType({ displayType: "hidden" });

    subTabla.addField({
      id: "sub_item_line",
      label: jsonLanguage["itemline"][Language],
      type: "integer",
    });
    subTabla.addField({
      id: "sub_item",
      label: jsonLanguage["item"][Language],
      type: "text",
    });

    subTabla.addField({
      id: "sub_nt",
      label: jsonLanguage["nt"][Language],
      type: "text",
    });
    subTabla.addField({
      id: "sub_rete",
      label: jsonLanguage["subtype"][Language],
      type: "text",
    });
    subTabla.addField({
      id: "sub_amountto",
      label: jsonLanguage["amountto"][Language],
      type: "text",
    });
    subTabla.addField({
      id: "sub_rate",
      label: jsonLanguage["rate"][Language],
      type: "text",
    });
    subTabla
      .addField({
        id: "sub_base",
        label: jsonLanguage["baseamount"][Language],
        type: "float",
      })
      .updateDisplayType({ displayType: "entry" });
    subTabla
      .addField({
        id: "sub_amount",
        label: jsonLanguage["amount"][Language],
        type: "float",
      })
      .updateDisplayType({ displayType: "entry" });
    subTabla
      .addField({
        id: "sub_base_hidden",
        label: jsonLanguage["baseamount"][Language],
        type: "float",
      })
      .updateDisplayType({ displayType: "hidden" });
    subTabla
      .addField({
        id: "sub_amount_hidden",
        label: jsonLanguage["amount"][Language],
        type: "float",
      })
      .updateDisplayType({ displayType: "hidden" });

    subTabla
      .addField({
        id: "sub_authorization",
        label: jsonLanguage["authorization"][Language],
        type: "text",
      })
      .updateDisplayType({ displayType: "entry" });
    subTabla
      .addField({
        id: "sub_number",
        label: jsonLanguage["number"][Language],
        type: "text",
      })
      .updateDisplayType({ displayType: "entry" });
    subTabla
      .addField({
        id: "custpage_sub_serie",
        label: jsonLanguage["serie"][Language],
        type: "select",
      })
      .updateDisplayType({ displayType: "entry" });
    subTabla
      .addField({
        id: "sub_serie",
        label: jsonLanguage["serie"][Language],
        type: "text",
      })
      .updateDisplayType({ displayType: "hidden" });

    subTabla
      .addField({
        id: "sub_document",
        label: jsonLanguage["document"][Language],
        type: "text",
      })
      .updateDisplayType({ displayType: "hidden" });
  }

  function setSubList(subTabla, jsonRet) {
    var jsonTypesRet = {
      custinvc: "invoice",
      custcred: "creditmemo",
      cashsale: "cashsale",
    };

    var k = 0;
    if (Object.keys(jsonRet).length) {
      for (var i in jsonRet) {
        var urlTransaction = url.resolveRecord({
          recordType: jsonTypesRet[jsonRet[i]["type"]],
          recordId: i,
          isEditMode: false,
        });

        for (var j = 0; j < jsonRet[i]["wht"].length; j++) {
          subTabla.setSublistValue({
            id: "sub_count",
            line: k,
            value: (j + 1).toString(),
          });
          subTabla.setSublistValue({
            id: "sub_type",
            line: k,
            value: jsonRet[i]["typetext"],
          });
          subTabla.setSublistValue({
            id: "sub_type_hidden",
            line: k,
            value: jsonRet[i]["type"],
          });
          subTabla.setSublistValue({
            id: "sub_id",
            line: k,
            value:
              '<a href="' + urlTransaction + '" target="_blank">' + i + "</a>",
          });
          subTabla.setSublistValue({ id: "sub_id_hidden", line: k, value: i });
          subTabla.setSublistValue({
            id: "sub_transa",
            line: k,
            value: jsonRet[i]["tranid"] || "&nbsp;",
          });
          subTabla.setSublistValue({
            id: "sub_cust",
            line: k,
            value: jsonRet[i]["entitytext"] || "&nbsp;",
          });
          subTabla.setSublistValue({
            id: "sub_date",
            line: k,
            value:
              format.format({
                value: jsonRet[i]["date"],
                type: format.Type.DATE,
              }) || "&nbsp;",
          });
          subTabla.setSublistValue({
            id: "sub_period",
            line: k,
            value: jsonRet[i]["periodvalue"] || "0",
          });
          subTabla.setSublistValue({
            id: "sub_item_line",
            line: k,
            value: parseInt(parseInt(jsonRet[i]["wht"][j]["line"]) + 1).toFixed(
              0
            ),
          });
          subTabla.setSublistValue({
            id: "sub_item",
            line: k,
            value: jsonRet[i]["wht"][j]["itemtext"] || "&nbsp;",
          });

          var urlNT = url.resolveRecord({
            recordType: "customrecord_lmry_national_taxes",
            recordId: jsonRet[i]["wht"][j]["nt"],
            isEditMode: false,
          });

          subTabla.setSublistValue({
            id: "sub_nt",
            line: k,
            value:
              '<a href="' +
              urlNT +
              '" target="_blank">' +
              jsonRet[i]["wht"][j]["nt"] +
              "</a>",
          });
          subTabla.setSublistValue({
            id: "sub_rete",
            line: k,
            value: jsonRet[i]["wht"][j]["retetext"] || "&nbsp;",
          });
          subTabla.setSublistValue({
            id: "sub_amountto",
            line: k,
            value: jsonRet[i]["wht"][j]["amountToText"] || "&nbsp;",
          });

          subTabla.setSublistValue({
            id: "sub_rate",
            line: k,
            value: jsonRet[i]["wht"][j]["ratetext"],
          });

          var base = parseFloat(jsonRet[i]["wht"][j]["base"]);
          base = base.toFixed(2);

          var amount = parseFloat(jsonRet[i]["wht"][j]["retencion"]);
          amount = amount.toFixed(2);

          subTabla.setSublistValue({ id: "sub_base", line: k, value: base });
          subTabla.setSublistValue({
            id: "sub_amount",
            line: k,
            value: amount,
          });

          subTabla.setSublistValue({
            id: "sub_base_hidden",
            line: k,
            value: base,
          });
          subTabla.setSublistValue({
            id: "sub_amount_hidden",
            line: k,
            value: amount,
          });

          if (jsonRet[i]["authorization"]) {
            subTabla.setSublistValue({
              id: "sub_authorization",
              line: k,
              value: jsonRet[i]["authorization"] || "&nbsp;",
            });
          }

          if (jsonRet[i]["taxnumber"]) {
            subTabla.setSublistValue({
              id: "sub_number",
              line: k,
              value: jsonRet[i]["taxnumber"] || "&nbsp;",
            });
          }

          subTabla.setSublistValue({
            id: "sub_serie",
            line: k,
            value: jsonRet[i]["serie"] || "0",
          });
          subTabla.setSublistValue({
            id: "sub_document",
            line: k,
            value: jsonRet[i]["document"] || "&nbsp;",
          });

          k++;
        }
      }
    }
  }

  function cleanCashRefundField(objRetencion) {
    objRetencion.setValue("custbody_lmry_carga_inicial", false);
    objRetencion.setValue("custbody_lmry_document_type", "");
    objRetencion.setValue("custbody_lmry_doc_ref_date", "");
    objRetencion.setValue("custbody_lmry_doc_ref_type", "");
    objRetencion.setValue("custbody_lmry_doc_serie_ref", "");
    objRetencion.setValue("custbody_lmry_ec_base_rate0", "");
    objRetencion.setValue("custbody_lmry_ec_base_rate12", "");
    objRetencion.setValue("custbody_lmry_ec_base_rate14", "");
    objRetencion.setValue("custbody_lmry_ec_estado_comfiar", "");
    objRetencion.setValue("custbody_lmry_ec_fue", "");
    objRetencion.setValue("custbody_lmry_ec_iceamt", "");
    objRetencion.setValue("custbody_lmry_ec_nref_num", "");
    objRetencion.setValue("custbody_lmry_ec_nref_ver", "");
    objRetencion.setValue("custbody_lmry_ec_nref_yyyy", "");
    objRetencion.setValue("custbody_lmry_ec_t10", "");
    objRetencion.setValue("custbody_lmry_ec_t2", "");
    objRetencion.setValue("custbody_lmry_ec_t6", "");
    objRetencion.setValue("custbody_lmry_ec_t7", "");
    objRetencion.setValue("custbody_lmry_ec_trans_doc", "");
    objRetencion.setValue("custbody_lmry_ec_wht_authorization", "");
    objRetencion.setValue("custbody_lmry_exchange_rate_doc_ref", "");
    objRetencion.setValue("custbody_lmry_foliofiscal", "");
    objRetencion.setValue("custbody_lmry_foliofiscal_doc_ref", "");
    objRetencion.setValue("custbody_lmry_identificador_comfiar_ec", "");
    objRetencion.setValue("custbody_lmry_num_aut_comfiar_ec", "");
    objRetencion.setValue("custbody_lmry_num_doc_ref", "");
    objRetencion.setValue("custbody_lmry_num_preimpreso", "");
    objRetencion.setValue("custbody_lmry_paymentmethod", "");
    objRetencion.setValue("custbody_lmry_pa_monto_letras", "");
    objRetencion.setValue("custbody_lmry_plazo_pago_dias", "");
    objRetencion.setValue("custbody_lmry_preimpreso_retencion", "");
    objRetencion.setValue("custbody_lmry_serie_doc_cxc", "");
    objRetencion.setValue("custbody_lmry_total_discount_einvoice", "");

    //E-DOCUMENT STANDARD
    objRetencion.setValue("custbody_psg_ei_template", ""); // E-DOCUMENT TEMPLATE
    objRetencion.setValue("custbody_psg_ei_status", ""); // E-DOCUMENT STATUS
    objRetencion.setValue("custbody_psg_ei_sending_method", ""); //E-DOCUMENT SENDING METHODS
    objRetencion.setValue("custbody_edoc_gen_trans_pdf", false); //GENERATE PDF
    objRetencion.setValue("custbody_edoc_generated_pdf", ""); //GENERATED PDF
    objRetencion.setValue("custbody_psg_ei_generated_edoc", ""); //GENERATED E-DOCUMENT
  }

  function _sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
      if (new Date().getTime() - start > milliseconds) {
        break;
      }
    }
  }

  function round2(number) {
    return parseFloat(Math.round(parseFloat(number) * 100) / 100);
  }

  function ECsetAmounts(context) {
    try {
      var recordObj = context.newRecord;
      var transactionID = recordObj.id;
      var jsonAmounts = {
        gross: {
          field: "custrecord_lmry_ec_gross_amount",
          amount: 0,
        },
        tax: {
          field: "custrecord_lmry_ec_tax_amount",
          amount: 0,
        },
        net: {
          field: "custrecord_lmry_ec_net_amount",
          amount: 0,
        },
      };
      var jsonLineAMounts = {};
      // Example: 2 lines
      var itemLineCount = recordObj.getLineCount({ sublistId: "item" });
      log.debug("itemLineCount", itemLineCount);
      if (itemLineCount != "" && itemLineCount != 0) {
        for (var i = 0; i < itemLineCount; i++) {
          var itemTypeText = recordObj.getSublistText({
            sublistId: "item",
            fieldId: "itemtype",
            line: i,
          });
          log.debug("itemTypeText", itemTypeText);

          if (itemTypeText == "Group" || itemTypeText == "EndGroup") continue;

          var grossAmount = recordObj.getSublistValue({
            sublistId: "item",
            fieldId: "grossamt",
            line: i,
          });
          var taxAmount = recordObj.getSublistValue({
            sublistId: "item",
            fieldId: "taxamount",
            line: i,
          });
          var netAmount = recordObj.getSublistValue({
            sublistId: "item",
            fieldId: "amount",
            line: i,
          });

          jsonAmounts["gross"]["amount"] += parseFloat(grossAmount);
          jsonAmounts["net"]["amount"] += parseFloat(netAmount);
          jsonAmounts["tax"]["amount"] += parseFloat(taxAmount);

          var applyWHT = recordObj.getSublistValue({
            sublistId: "item",
            fieldId: "custcol_lmry_apply_wht_tax",
            line: i,
          });
          var catalog = recordObj.getSublistValue({
            sublistId: "item",
            fieldId: "custcol_lmry_ec_concept_ret",
            line: i,
          });
          var lineUniqueKey = recordObj.getSublistValue({
            sublistId: "item",
            fieldId: "lineuniquekey",
            line: i,
          });
          var taxLine = recordObj.getSublistValue({
            sublistId: "item",
            fieldId: "custcol_4601_witaxline",
            line: i,
          });
          var itemType = recordObj.getSublistValue({
            sublistId: "item",
            fieldId: "itemtype",
            line: i,
          });
          var item = recordObj.getSublistValue({
            sublistId: "item",
            fieldId: "item",
            line: i,
          });
          var itemText = recordObj.getSublistText({
            sublistId: "item",
            fieldId: "item",
            line: i,
          });

          jsonLineAMounts[i] = {
            gross: grossAmount,
            tax: taxAmount,
            net: netAmount,
            applywht: applyWHT,
            catalog: catalog,
            lineuniquekey: lineUniqueKey,
            taxline: taxLine,
            itemtype: itemType,
            item: item,
            itemtext: itemText,
          };
        }
      }
      log.debug("jsonLineAMounts", jsonLineAMounts);
      var searchEC = search.create({
        type: "customrecord_lmry_ec_transaction_fields",
        filters: [
          {
            name: "custrecord_lmry_ec_related_transaction",
            operator: search.Operator.IS,
            values: transactionID,
          },
          {
            name: "isinactive",
            operator: search.Operator.IS,
            values: "F",
          },
        ],
      });
      // Buscar si existen record relacionados al id de la transaccion
      searchEC = searchEC.run().getRange(0, 1);

      if (searchEC && searchEC.length) {
        var ecTransactionField = record.load({
          type: "customrecord_lmry_ec_transaction_fields",
          id: searchEC[0].id,
        });
      } else {
        var ecTransactionField = record.create({
          type: "customrecord_lmry_ec_transaction_fields",
        });
      }

      ecTransactionField.setValue(
        "custrecord_lmry_ec_related_transaction",
        transactionID
      );
      ecTransactionField.setValue(
        "custrecord_lmry_ec_lines_amount",
        JSON.stringify(jsonLineAMounts)
      );

      for (var i in jsonAmounts) {
        ecTransactionField.setValue(
          jsonAmounts[i]["field"],
          jsonAmounts[i]["amount"]
        );
      }

      ecTransactionField.save({
        disableTriggers: true,
        ignoreMandatoryFields: true,
      });
    } catch (error) {
      log.error("ECsetAmounts", error);
    }
  }
  // TODO: afterSubmitTransaction
  function _getTransactions(idTransactions) {
    try {
      var Transaction_Columns = [
        search.createColumn({ name: "internalid", sort: search.Sort.ASC }),
        /* search.createColumn({
          name: "formulatext",
          formula: "{tranid}",
        }), */
        search.createColumn({ name: "tranid" }),
        search.createColumn({ name: "trandate" }),
        search.createColumn({ name: "custbody_lmry_subsidiary_country" }),
        search.createColumn({ name: "currency" }),
        search.createColumn({ name: "fxamount" }),
        search.createColumn({ name: "type" }),
        search.createColumn({ name: "entity" }),
        search.createColumn({ name: "postingperiod" }),
        search.createColumn({ name: "custbody_lmry_apply_wht_code" }),
        search.createColumn({ name: "subsidiary" }),
        search.createColumn({ name: "exchangerate" }),
        search.createColumn({ name: "account" }),
        search.createColumn({
          name: "custrecord_lmry_ec_rte_iva",
          join: "CUSTRECORD_LMRY_EC_RELATED_TRANSACTION",
        }),
        search.createColumn({
          name: "custrecord_lmry_ec_rte_fte",
          join: "CUSTRECORD_LMRY_EC_RELATED_TRANSACTION",
        }),
        search.createColumn({
          name: "custbody_lmry_ec_wht_authorization",
        }),
        search.createColumn({
          name: "custbody_lmry_preimpreso_retencion",
        }),
        search.createColumn({
          name: "custbody_lmry_serie_doc_cxc",
        }),
        search.createColumn({
          name: "custbody_lmry_document_type",
        }),
        search.createColumn({
          name: "custrecord_lmry_ec_gross_amount",
          join: "CUSTRECORD_LMRY_EC_RELATED_TRANSACTION",
        }),
        search.createColumn({
          name: "custrecord_lmry_ec_tax_amount",
          join: "CUSTRECORD_LMRY_EC_RELATED_TRANSACTION",
        }),
        search.createColumn({
          name: "custrecord_lmry_ec_net_amount",
          join: "CUSTRECORD_LMRY_EC_RELATED_TRANSACTION",
        }),
        search.createColumn({
          name: "custrecord_lmry_ec_lines_amount",
          join: "CUSTRECORD_LMRY_EC_RELATED_TRANSACTION",
        }),
      ];

      if (FEATURE_DEPARMENTS) {
        Transaction_Columns.push(search.createColumn({ name: "department" }));
      }

      if (FEATURE_CLASS) {
        Transaction_Columns.push(search.createColumn({ name: "class" }));
      }

      if (FEATURE_LOCATION) {
        Transaction_Columns.push(search.createColumn({ name: "location" }));
      }
      var Transaction_Filters = [
        search.createFilter({
          name: "internalid",
          operator: search.Operator.ANYOF,
          values: idTransactions,
        }),
        search.createFilter({
          name: "mainline",
          operator: search.Operator.IS,
          values: "T",
        }),
        search.createFilter({
          name: "voided",
          operator: search.Operator.IS,
          values: "F",
        }),
        search.createFilter({
          name: "type",
          operator: search.Operator.ANYOF,
          values: ["CashSale", "CustInvc", "CustCred"],
        }),
        search.createFilter({
          name: "custrecord_lmry_ec_gross_amount",
          join: "CUSTRECORD_LMRY_EC_RELATED_TRANSACTION",
          operator: search.Operator.ISNOTEMPTY,
          values: "",
        }),
        search.createFilter({
          name: "custrecord_lmry_ec_lines_amount",
          join: "CUSTRECORD_LMRY_EC_RELATED_TRANSACTION",
          operator: search.Operator.ISNOTEMPTY,
          values: "",
        }),
      ];

      var searchTransactions = search.create({
        type: "transaction",
        columns: Transaction_Columns,
        filters: Transaction_Filters,
      });

      var resultTransactions = searchTransactions.run().getRange(0, 1000);

      return resultTransactions;
    } catch (error) {
      log.error("[ afterSubmit - searchTransactions ]", error);
    }
  }
  function searchNTbyWHT(subsidiary, CONCEPT) {
    try {
      var NT_Columns = [
        search.createColumn({ name: "internalid" }),
        search.createColumn({ name: "custrecord_lmry_ntax_taxitem" }),
        search.createColumn({ name: "custrecord_lmry_ntax_taxrate" }),
        search.createColumn({ name: "custrecord_lmry_ntax_taxcode" }),
        search.createColumn({
          name: "subtype",
          join: "custrecord_lmry_ntax_taxitem",
        }),
        search.createColumn({ name: "custrecord_lmry_ntax_department" }),
        search.createColumn({ name: "custrecord_lmry_ntax_class" }),
        search.createColumn({ name: "custrecord_lmry_ntax_location" }),
        search.createColumn({ name: "custrecord_lmry_ntax_appliesto" }),
        search.createColumn({ name: "custrecord_lmry_ntax_amount" }),
        search.createColumn({ name: "custrecord_lmry_ntax_minamount" }),
        search.createColumn({ name: "custrecord_lmry_ntax_description" }),
        search.createColumn({ name: "custrecord_lmry_ntax_sub_type" }),
        search.createColumn({ name: "custrecord_lmry_ec_ntax_wht_taxcode" }),
        search.createColumn({ name: "custrecord_lmry_ntax_taxtype" }),
        search.createColumn({ name: "custrecord_lmry_ntax_datefrom" }),
        search.createColumn({ name: "custrecord_lmry_ntax_dateto" }),
        search.createColumn({ name: "custrecord_lmry_ec_ntax_catalog" }),
        search.createColumn({ name: "custrecord_lmry_ntax_taxrate_pctge" }),
        search.createColumn({ name: "custrecord_lmry_ntax_gen_transaction" }),
        search.createColumn({
          name: "custrecord_lmry_ntax_transactiontypes",
        }),
      ];
      var NT_Filters = [
        search.createFilter({
          name: "custrecord_lmry_ec_ntax_catalog",
          operator: search.Operator.ANYOF,
          values: [CONCEPT.NT_CONCEPT_RET],
        }),
        search.createFilter({
          name: "isinactive",
          operator: search.Operator.IS,
          values: ["F"],
        }),
        search.createFilter({
          name: "custrecord_lmry_ntax_taxtype",
          operator: search.Operator.ANYOF,
          // 1: Retención
          values: [1],
        }),
        search.createFilter({
          name: "custrecord_lmry_ntax_gen_transaction",
          operator: search.Operator.ANYOF,
          // 5: WHT by Transaction
          values: [5],
        }),
        search.createFilter({
          name: "custrecord_lmry_ntax_transactiontypes",
          operator: search.Operator.ANYOF,
          // 1: Invoice / CustInv
          // 3: Cash Sale / CashSale
          // 8: Credit Memo / CustCredit
          values: [1, 3, 8],
        }),
        search.createFilter({
          name: "custrecord_lmry_ntax_amount",
          operator: search.Operator.NONEOF,
          values: "@NONE@",
        }),
        search.createFilter({
          name: "custrecord_lmry_ntax_publdate",
          operator: search.Operator.ISNOTEMPTY,
          values: "",
        }),
      ];
      if (FEATURE_SUBSIDIARY) {
        NT_Filters.push(
          search.createFilter({
            name: "custrecord_lmry_ntax_subsidiary",
            operator: search.Operator.IS,
            values: subsidiary,
          })
        );
      }
      // Buscando los record que coincidan con los filtros
      var searchNT = search
        .create({
          type: "customrecord_lmry_national_taxes",
          columns: NT_Columns,
          filters: NT_Filters,
        })
        .run()
        .getRange(0, 10);
      return searchNT;
    } catch (error) {
      log.error("searchNTbyWHT", error);
    }
  }
  return {
    afterSubmitTransaction: afterSubmitTransaction,
    searchNTbyWHT: searchNTbyWHT,
    createSubList: createSubList,
    setSubList: setSubList,
    ECsetAmounts: ECsetAmounts,
  };
});
