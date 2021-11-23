/**
 * Module Description
 *
 * Version    Date            Author           Remarks
 * 1.00       Nov 2020        LatamReady
 * File : LMRY_BR_ImportTax_PLGN.js
 */
var objContext = nlapiGetContext();

var LMRY_script = "LatamReady - BR Vendor Payment Import Tax PLGN";

var FEAT_SUBSIDIARY = false;
var FEAT_CUSTOMSEGMENTS = false;
var FEAT_SUITETAX = false;
var FEAT_DEPT = false;
var FEAT_CLASS = false;
var FEAT_LOC = false;
var FEAT_MULTIBOOK = false;
var FEAT_ACC_MAPPING = false;
var DEPTMANDATORY = false;
var LOCMANDATORY = false;
var CLASSMANDATORY = false;
var DEPTSPERLINE = false;
var CLASSESPERLINE = false;
var FEAT_INSTALLMENTS = false;
var ACCOUNT_MAP = {}

function customizeGlImpact(transactionRecord, standardLines, customLines, book) {
  try {
    var country = transactionRecord.getFieldValue("custbody_lmry_subsidiary_country");
    var transactionType = transactionRecord.getFieldValue("baserecordtype");
    if (Number(country) == 30 && transactionType == "vendorpayment") {
      nlapiLogExecution("ERROR", "transactionRecord.id", transactionRecord.id);

      FEAT_SUBSIDIARY = objContext.getFeature('SUBSIDIARIES');
      FEAT_CUSTOMSEGMENTS = objContext.getFeature("customsegments");
      FEAT_DEPT = objContext.getFeature("departments");
      FEAT_CLASS = objContext.getFeature("classes");
      FEAT_LOC = objContext.getFeature("locations");
      FEAT_MULTIBOOK = objContext.getFeature('MULTIBOOK');
      FEAT_ACC_MAPPING = objContext.getFeature('coaclassificationmanagement');
      DEPTMANDATORY = objContext.getPreference('DEPTMANDATORY');
      LOCMANDATORY = objContext.getPreference('LOCMANDATORY');
      CLASSMANDATORY = objContext.getPreference('CLASSMANDATORY');
      DEPTSPERLINE = objContext.getPreference('DEPTSPERLINE');
      CLASSESPERLINE = objContext.getPreference('CLASSESPERLINE');
      FEAT_INSTALLMENTS = objContext.getFeature('installments');

      nlapiLogExecution("ERROR", "bookId", book.getId());

      var setupTax = getSetupTaxSubsidiary(transactionRecord);
      nlapiLogExecution("ERROR", "setupTax", JSON.stringify(setupTax));
      //Solo para flujo 3
      if (Number(setupTax["taxFlow"]) == 4) {
        var customSegments = getCustomSegments();
        nlapiLogExecution("ERROR", "customSegments", JSON.stringify(customSegments));

        var glLines = getGlLines(transactionRecord, book, customSegments, setupTax);
        nlapiLogExecution("ERROR", "glLines", JSON.stringify(glLines));
        if (glLines["lines"].length) {
          var entity = transactionRecord.getFieldValue("entity");
          for (var i = 0; i < glLines["lines"].length; i++) {
            var line = glLines["lines"][i];
            if (line["debitAccount"] && line["creditAccount"]) {
              if (line["debitAmount"]) {
                var newLineDebit = customLines.addNewLine();
                newLineDebit.setDebitAmount(parseFloat(line["debitAmount"]));
                newLineDebit.setAccountId(parseInt(line["debitAccount"]));
                newLineDebit.setMemo(line["memo"]);
                newLineDebit.setEntityId(parseInt(entity));

                if (line["department"] && (FEAT_DEPT == "T" || FEAT_DEPT == true) && (DEPTSPERLINE == "T" || DEPTSPERLINE == true)) {
                  newLineDebit.setDepartmentId(parseInt(line["department"]));
                }

                if (line["class"] && (FEAT_CLASS == "T" || FEAT_CLASS == true) && (CLASSESPERLINE == "T" || CLASSESPERLINE == true)) {
                  newLineDebit.setClassId(parseInt(line["class"]));
                }

                if (line["location"] && (FEAT_LOC == "T" || FEAT_LOC == true)) {
                  newLineDebit.setLocationId(parseInt(line["location"]));
                }

                for (var s = 0; s < customSegments.length; s++) {
                  var segmentId = customSegments[s];
                  var segmentValue = line[segmentId];
                  if (segmentValue) {
                    newLineDebit.setSegmentValueId(segmentId, parseInt(segmentValue));
                  }
                }
              }
              if (line["creditAmount"]) {
                var newLineCredit = customLines.addNewLine();
                newLineCredit.setCreditAmount(parseFloat(line["creditAmount"]));
                newLineCredit.setAccountId(parseInt(line["creditAccount"]));
                newLineCredit.setMemo(line["memo"]);
                newLineCredit.setEntityId(parseInt(entity));

                if (line["department"] && (FEAT_DEPT == "T" || FEAT_DEPT == true) && (DEPTSPERLINE == "T" || DEPTSPERLINE == true)) {
                  newLineCredit.setDepartmentId(parseInt(line["department"]));
                }

                if (line["class"] && (FEAT_CLASS == "T" || FEAT_CLASS == true) && (CLASSESPERLINE == "T" || CLASSESPERLINE == true)) {
                  newLineCredit.setClassId(parseInt(line["class"]));
                }

                if (line["location"] && (FEAT_LOC == "T" || FEAT_LOC == true)) {
                  newLineCredit.setLocationId(parseInt(line["location"]));
                }

                for (var s = 0; s < customSegments.length; s++) {
                  var segmentId = customSegments[s];
                  var segmentValue = line[segmentId];
                  if (segmentValue) {
                    newLineCredit.setSegmentValueId(segmentId, parseInt(segmentValue));
                  }
                }
              }
            }
          }

          if (glLines["revaluationLine"]) {
            var line = glLines["revaluationLine"];
            if ((line["debitAmount"] || line["creditAmount"]) && line["account"]) {
              var newGlLine = customLines.addNewLine();
              if (line["debitAmount"]) {
                newGlLine.setDebitAmount(parseFloat(line["debitAmount"]));
              } else {
                newGlLine.setCreditAmount(parseFloat(line["creditAmount"]))
              }

              newGlLine.setAccountId(parseInt(line["account"]));
              var memo = "Currency Revaluation";
              newGlLine.setMemo(memo);
              newGlLine.setEntityId(parseInt(entity));

              if (line["department"] && (FEAT_DEPT == "T" || FEAT_DEPT == true) && (DEPTSPERLINE == "T" || DEPTSPERLINE == true)) {
                newGlLine.setDepartmentId(parseInt(line["department"]));
              }

              if (line["class"] && (FEAT_CLASS == "T" || FEAT_CLASS == true) && (CLASSESPERLINE == "T" || CLASSESPERLINE == true)) {
                newGlLine.setClassId(parseInt(line["class"]));
              }

              if (line["location"] && (FEAT_LOC == "T" || FEAT_LOC == true)) {
                newGlLine.setLocationId(parseInt(line["location"]));
              }

              for (var s = 0; s < customSegments.length; s++) {
                var segmentId = customSegments[s];
                var segmentValue = line[segmentId];
                if (segmentValue) {
                  newGlLine.setSegmentValueId(segmentId, parseInt(segmentValue));
                }
              }
            }
          }
        }
      }
    }
  }
  catch (err) {
    sendemail(' [ customizeGlImpact ] ' + err, LMRY_script);
  }
}

function getCustomSegments() {
  var customSegments = [];
  if (FEAT_CUSTOMSEGMENTS == true || FEAT_CUSTOMSEGMENTS == "T") {

    //Se buscan los segmentos configurados en el record LatamReady - Setup Custom Segments
    var searchSegmentRecords = nlapiCreateSearch("customrecord_lmry_setup_cust_segm",
      [
        ["isinactive", "is", "F"]
      ],
      [
        new nlobjSearchColumn("internalid"),
        new nlobjSearchColumn("custrecord_lmry_setup_cust_segm")
      ]);

    var results = searchSegmentRecords.runSearch().getResults(0, 1000);
    var configuredSegments = [];

    for (var i = 0; i < results.length; i++) {
      var segmentId = results[i].getValue("custrecord_lmry_setup_cust_segm") || "";
      segmentId = segmentId.trim();
      if (segmentId) {
        configuredSegments.push(segmentId);
      }
    }

    if (configuredSegments.length) {
      var filterSegments = [];

      for (var i = 0; i < configuredSegments.length; i++) {
        filterSegments.push("OR", ["scriptid", "startswith", configuredSegments[i]])
      }

      filterSegments = filterSegments.slice(1);

      var filters = [
        ["isinactive", "is", "F"], "AND",
        ["glimpact", "is", "T"], "AND",
        filterSegments
      ];

      //Se filtran los Custom segments con el campo GL Impact activo
      var searchSegments = nlapiCreateSearch("customsegment", filters,
        [
          new nlobjSearchColumn("internalid").setSort(false),
          new nlobjSearchColumn("scriptid")]);

      var results = searchSegments.runSearch().getResults(0, 1000);

      for (var i = 0; i < results.length; i++) {
        var segmentId = results[i].getValue("scriptid");
        customSegments.push(segmentId);
      }
    }
  }
  return customSegments;
}

function getGlLines(transactionRecord, book, customSegments, setupTax) {
  var glLines = { lines: [], revaluationLine: {} }

  if (setupTax["deficitRevaluationAccount"] && setupTax["earningRevaluationAccount"]) {

    var taxResultsByBill = getTaxResults(transactionRecord);
    nlapiLogExecution("ERROR", "taxResultsByBill", JSON.stringify(taxResultsByBill));

    if ((FEAT_ACC_MAPPING == "T" || FEAT_ACC_MAPPING == true) && !book.isPrimary()) {
      nlapiLogExecution("ERROR", "ACCOUNT_MAP", JSON.stringify(ACCOUNT_MAP));
      getGlobalAccountMappingsByBook(transactionRecord, book);
      nlapiLogExecution("ERROR", "ACCOUNT_MAP", JSON.stringify(ACCOUNT_MAP));
    }
    var exchangeRate = getExchangeRatebyBook(transactionRecord, book);
    nlapiLogExecution("ERROR", "exchangeRate", exchangeRate);

    var bills = getBillValues(transactionRecord, customSegments);
    nlapiLogExecution("ERROR", "bills", JSON.stringify(bills));

    var currRevaluationTotal = 0.00;

    var numApplieds = transactionRecord.getLineItemCount("apply");
    for (var i = 1; i <= numApplieds; i++) {
      var isApplied = transactionRecord.getLineItemValue("apply", "apply", i);
      if (isApplied == "T" || isApplied == true) {
        var idBill = transactionRecord.getLineItemValue("apply", "internalid", i);
        idBill = String(idBill);
        var amountPaid = transactionRecord.getLineItemValue("apply", "amount", i);
        amountPaid = parseFloat(amountPaid);
        if (bills[idBill]) {
          var total = bills[idBill]["total"];
          var taxResults = taxResultsByBill[idBill];
          if (taxResults) {
            for (var j = 0; j < taxResults.length; j++) {
              var debitAccount = taxResults[j]["creditAccount"];
              debitAccount = String(debitAccount);
              var creditAccount = taxResults[j]["reverseAccount"];
              creditAccount = String(creditAccount);
              var taxAmount = taxResults[j]["amount"];
              var memo = "Latam - Import " + taxResults[j]["subtype"];
              var lineUniqueKey = taxResults[j]["lineUniqueKey"];
              var strAccountBook = taxResults[j]["strAccBooks"];
              var segmentConfig = taxResults[j]["custSegments"] || {};

              var department = bills[idBill][lineUniqueKey]["department"] || bills[idBill]["department"] || "";
              var class_ = bills[idBill][lineUniqueKey]["class"] || bills[idBill]["class"] || "";
              var location = bills[idBill][lineUniqueKey]["location"] || bills[idBill]["location"] || "";

              if (setupTax["isDefaultClassif"] == "F" || setupTax["isDefaultClassif"] == false) {
                department = bills[idBill]["department"] || ""
                class_ = bills[idBill]["class"] || "";
                location = bills[idBill]["location"] || "";
              }

              if (DEPTMANDATORY == "T" || DEPTMANDATORY == true) {
                if (setupTax["isDefaultClassif"] == "T" || setupTax["isDefaultClassif"] == true) {
                  department = department || setupTax["department"] || ""
                } else {
                  department = bills[idBill][lineUniqueKey]["department"] || setupTax["department"] || "";
                }
              }

              if (CLASSMANDATORY == "T" || CLASSMANDATORY == true) {
                if (setupTax["isDefaultClassif"] == "T" || setupTax["isDefaultClassif"] == true) {
                  class_ = class_ || setupTax["class"] || ""
                } else {
                  class_ = bills[idBill][lineUniqueKey]["class"] || setupTax["class"] || "";
                }
              }

              if (LOCMANDATORY == "T" || LOCMANDATORY == true) {
                if (setupTax["isDefaultClassif"] == "T" || setupTax["isDefaultClassif"] == true) {
                  location = location || setupTax["location"] || ""
                } else {
                  location = bills[idBill][lineUniqueKey]["location"] || setupTax["location"] || "";
                }
              }

              var billExchangeRate = getExchangeRateFromTaxResult(strAccountBook, book);
              billExchangeRate = parseFloat(billExchangeRate);

              var debitAmount = round2(taxAmount * (amountPaid / total)) * billExchangeRate;
              debitAmount = round2(debitAmount);

              var creditAmount = round2(taxAmount * (amountPaid / total)) * exchangeRate;
              creditAmount = round2(creditAmount);

              var difference = round2(debitAmount - creditAmount)
              currRevaluationTotal = round2(currRevaluationTotal + difference);

              var line = {
                "debitAmount": debitAmount,
                "creditAmount": creditAmount,
                "memo": memo,
                "debitAccount": ACCOUNT_MAP[debitAccount],
                "creditAccount": ACCOUNT_MAP[creditAccount],
                "department": department,
                "class": class_,
                "location": location,
              }


              for (var s = 0; s < customSegments.length; s++) {
                var segmentId = customSegments[s];
                line[segmentId] = segmentConfig[segmentId] || bills[idBill][segmentId] || "";
              }

              glLines["lines"].push(line);
            }
          }
        }
      }
    }


    nlapiLogExecution("ERROR", "currRevaluationTotal", currRevaluationTotal);
    if (currRevaluationTotal) {
      var line = {};
      var deficitAccount = setupTax["deficitRevaluationAccount"];
      deficitAccount = String(deficitAccount);
      var earningAccount = setupTax["earningRevaluationAccount"];
      earningAccount = String(earningAccount);

      if (currRevaluationTotal > 0) {
        line["creditAmount"] = currRevaluationTotal;
        line["account"] = ACCOUNT_MAP[deficitAccount];
      } else {
        line["debitAmount"] = Math.abs(currRevaluationTotal);
        line["account"] = ACCOUNT_MAP[earningAccount];
      }

      if (FEAT_DEPT == "T" || FEAT_DEPT == true) {
        line["department"] = transactionRecord.getFieldValue("department") || "";
      }


      if (FEAT_CLASS == "T" || FEAT_CLASS == true) {
        line["class"] = transactionRecord.getFieldValue("class") || "";
      }


      if (FEAT_LOC == "T" || FEAT_LOC == true) {
        line["location"] = transactionRecord.getFieldValue("location") || "";
      }

      for (var s = 0; s < customSegments.length; s++) {
        var segmentId = customSegments[s];
        line[segmentId] = transactionRecord.getFieldValue(segmentId) || "";
      }
      nlapiLogExecution("ERROR", "line", JSON.stringify(line));

      glLines["revaluationLine"] = line;
    }
  }
  return glLines;
}

function getGlobalAccountMappingsByBook(transactionRecord, book) {
  if (Object.keys(ACCOUNT_MAP).length) {
    var date = transactionRecord.getFieldValue("trandate");
    var filters = [
      ["sourceaccount", "anyof", Object.keys(ACCOUNT_MAP)], "AND",
      ["accountingbook", "anyof", book.getId()], "AND",
      ["effectivedate", "onorbefore", date], "AND",
      [
        ["enddate", "isempty", ""], "OR",
        [
          ["enddate", "isnotempty", ""], "AND",
          ["enddate", "onorafter", date]
        ]
      ]
    ]

    if (FEAT_SUBSIDIARY == true || FEAT_SUBSIDIARY == "T") {
      var subsidiary = transactionRecord.getFieldValue("subsidiary");
      filters.push("AND", ["subsidiary", "anyof", subsidiary]);
    }

    var columns = [new nlobjSearchColumn("internalid"), new nlobjSearchColumn("sourceaccount"), new nlobjSearchColumn("destinationaccount")];
    var searchGlobalAccount = nlapiCreateSearch("globalaccountmapping", filters, columns);

    var results = searchGlobalAccount.runSearch().getResults(0, 1000);

    for (var i = 0; i < results.length; i++) {
      var sourceAccount = results[i].getValue("sourceaccount");
      var destinationAccount = results[i].getValue("destinationaccount");
      if (ACCOUNT_MAP[String(sourceAccount)] && destinationAccount) {
        ACCOUNT_MAP[String(sourceAccount)] = destinationAccount;
      }
    }
  }
}

function round2(num) {
  if (num >= 0) {
    return parseFloat(Math.round(parseFloat(num) * 1e2 + 1e-3) / 1e2);
  } else {
    return parseFloat(Math.round(parseFloat(num) * 1e2 - 1e-3) / 1e2);
  }
}

function getExchangeRateFromTaxResult(stringAccountingBooks, book) {
  var bookId = book.getId();
  if (book.isPrimary()) {
    bookId = 0;
  }

  var exchangeRate = 1;
  if (stringAccountingBooks) {
    var parts = stringAccountingBooks.split("&");
    var idBooks = parts[0].split("|");
    var exchangeRates = parts[1].split("|");
    exchangeRate = exchangeRates[idBooks.indexOf(String(bookId))] || 1;
  }
  return parseFloat(exchangeRate);
}


function getExchangeRatebyBook(transactionRecord, book) {
  var exchangeRate = transactionRecord.getFieldValue("exchangerate");
  if (FEAT_MULTIBOOK == "T" || FEAT_MULTIBOOK == true) {
    if (!book.isPrimary()) {
      var bookId = book.getId();
      var numBooks = transactionRecord.getLineItemCount("accountingbookdetail");
      //Se busca el exchange del Libro actual
      for (var i = 1; i <= numBooks; i++) {
        var currentBookId = transactionRecord.getLineItemValue("accountingbookdetail", "bookid", i);
        if (Number(bookId) == Number(currentBookId)) {
          exchangeRate = transactionRecord.getLineItemValue("accountingbookdetail", "exchangerate", i);
          exchangeRate = parseFloat(exchangeRate);
        }
      }
    }
  }

  return exchangeRate;
}

function getSetupTaxSubsidiary(transactionRecord) {
  var setupTax = {};
  var filters = [
    ["isinactive", "is", "F"]
  ];

  if (FEAT_SUBSIDIARY == "T" || FEAT_SUBSIDIARY == true) {
    var subsidiary = transactionRecord.getFieldValue("subsidiary");
    filters.push("AND", ["custrecord_lmry_setuptax_subsidiary", "anyof", subsidiary]);
  }

  var searchSetup = nlapiCreateSearch("customrecord_lmry_setup_tax_subsidiary", filters,
    [
      new nlobjSearchColumn("internalid"),
      new nlobjSearchColumn("custrecord_lmry_setuptax_depclassloc"),
      new nlobjSearchColumn("custrecord_lmry_br_tax_earning_account"),
      new nlobjSearchColumn("custrecord_lmry_br_tax_deficit_account"),
      new nlobjSearchColumn("custrecord_lmry_setuptax_department"),
      new nlobjSearchColumn("custrecord_lmry_setuptax_class"),
      new nlobjSearchColumn("custrecord_lmry_setuptax_location"),
      new nlobjSearchColumn("custrecord_lmry_setuptax_br_ap_flow")
    ]);

  var results = searchSetup.runSearch().getResults(0, 1);
  if (results && results.length) {
    var deficitRevaluationAccount = results[0].getValue("custrecord_lmry_br_tax_deficit_account");
    var earningRevaluationAccount = results[0].getValue("custrecord_lmry_br_tax_earning_account");
    setupTax = {
      "isDefaultClassif": results[0].getValue("custrecord_lmry_setuptax_depclassloc"),
      "deficitRevaluationAccount": deficitRevaluationAccount,
      "earningRevaluationAccount": earningRevaluationAccount,
      "department": results[0].getValue("custrecord_lmry_setuptax_department"),
      "class": results[0].getValue("custrecord_lmry_setuptax_class"),
      "location": results[0].getValue("custrecord_lmry_setuptax_location"),
      "taxFlow": results[0].getValue("custrecord_lmry_setuptax_br_ap_flow")
    };

    if (deficitRevaluationAccount && !ACCOUNT_MAP[deficitRevaluationAccount]) {
      ACCOUNT_MAP[deficitRevaluationAccount] = deficitRevaluationAccount;
    }

    if (earningRevaluationAccount && !ACCOUNT_MAP[earningRevaluationAccount]) {
      ACCOUNT_MAP[earningRevaluationAccount] = earningRevaluationAccount;
    }

  }
  return setupTax;
}

function getTaxResults(transactionRecord) {
  var taxResults = {};
  var bills = []
  var numApplieds = transactionRecord.getLineItemCount("apply");
  for (var i = 1; i <= numApplieds; i++) {
    var isApplied = transactionRecord.getLineItemValue("apply", "apply", i);
    if (isApplied == "T" || isApplied == true) {
      var internalid = transactionRecord.getLineItemValue("apply", "internalid", i);
      if (internalid && bills.indexOf(Number(internalid)) == -1) {
        bills.push(Number(internalid));
      }
    }
  }

  if (bills.length) {
    var filters = [
      ["isinactive", "is", "F"], "AND",
      ["custrecord_lmry_tax_type", "anyof", "4"], "AND",
      ["custrecord_lmry_br_transaction", "anyof", bills], "AND",
      ["custrecord_lmry_br_is_import_tax_result", "is", "T"]
    ];
    var columns = [
      new nlobjSearchColumn("internalid"),
      new nlobjSearchColumn("custrecord_lmry_br_transaction"),
      new nlobjSearchColumn("custrecord_lmry_br_total"),
      new nlobjSearchColumn("custrecord_lmry_br_type"),
      new nlobjSearchColumn("custrecord_lmry_br_positem"),
      new nlobjSearchColumn("custrecord_lmry_lineuniquekey"),
      new nlobjSearchColumn("custrecord_lmry_accounting_books"),
      new nlobjSearchColumn("custrecord_lmry_ccl"),
      new nlobjSearchColumn("custrecord_lmry_ntax"),
      new nlobjSearchColumn("custrecord_lmry_ccl_br_nivel_contabiliz", "custrecord_lmry_ccl"),
      new nlobjSearchColumn("custrecord_lmry_nt_br_nivel_contabiliz", "custrecord_lmry_ntax"),
      new nlobjSearchColumn("custrecord_lmry_ccl_gl_impact", "custrecord_lmry_ccl"),
      new nlobjSearchColumn("custrecord_lmry_ntax_gl_impact", "custrecord_lmry_ntax"),
      new nlobjSearchColumn("custrecord_lmry_ccl_br_reverse_account", "custrecord_lmry_ccl"),
      new nlobjSearchColumn("custrecord_lmry_nt_br_reverse_account", "custrecord_lmry_ntax"),
      new nlobjSearchColumn("custrecord_lmry_br_ccl_account2", "custrecord_lmry_ccl"),
      new nlobjSearchColumn("custrecord_lmry_ntax_credit_account", "custrecord_lmry_ntax"),
      new nlobjSearchColumn("custrecord_lmry_ccl_config_segment", "custrecord_lmry_ccl"),
      new nlobjSearchColumn("custrecord_lmry_ntax_config_segment", "custrecord_lmry_ntax")
    ];

    var searchTaxResults = nlapiCreateSearch("customrecord_lmry_br_transaction", filters, columns);

    var results = searchTaxResults.runSearch().getResults(0, 1000);

    if (results && results.length) {
      for (var i = 0; i < results.length; i++) {
        var idCC = results[i].getValue("custrecord_lmry_ccl");
        var idNT = results[i].getValue("custrecord_lmry_ntax");
        var importTaxLevel = "";
        var creditAccount = "", reverseAccount = "", glImpact = false, custSegments = "";
        if (idCC) {
          importTaxLevel = results[i].getValue("custrecord_lmry_ccl_br_nivel_contabiliz", "custrecord_lmry_ccl");
          glImpact = results[i].getValue("custrecord_lmry_ccl_gl_impact", "custrecord_lmry_ccl");
          creditAccount = results[i].getValue("custrecord_lmry_br_ccl_account2", "custrecord_lmry_ccl");
          reverseAccount = results[i].getValue("custrecord_lmry_ccl_br_reverse_account", "custrecord_lmry_ccl");
          custSegments = results[i].getValue("custrecord_lmry_ccl_config_segment", "custrecord_lmry_ccl");
        } else if (idNT) {
          importTaxLevel = results[i].getValue("custrecord_lmry_nt_br_nivel_contabiliz", "custrecord_lmry_ntax");
          glImpact = results[i].getValue("custrecord_lmry_ntax_gl_impact", "custrecord_lmry_ntax");
          creditAccount = results[i].getValue("custrecord_lmry_ntax_credit_account", "custrecord_lmry_ntax");
          reverseAccount = results[i].getValue("custrecord_lmry_nt_br_reverse_account", "custrecord_lmry_ntax");
          custSegments = results[i].getValue("custrecord_lmry_ntax_config_segment", "custrecord_lmry_ntax");
        }

        if ((glImpact == "T" || glImpact == true) && importTaxLevel && creditAccount && reverseAccount) {
          var subtype = results[i].getValue("custrecord_lmry_br_type");
          var lineUniqueKey = results[i].getValue("custrecord_lmry_lineuniquekey");
          var idBill = results[i].getValue("custrecord_lmry_br_transaction");
          var strAccBooks = results[i].getValue("custrecord_lmry_accounting_books");
          var amount = results[i].getValue("custrecord_lmry_br_total") || 0.00;
          amount = parseFloat(amount);

          if (custSegments) {
            custSegments = JSON.parse(custSegments)
          }

          if (!taxResults[String(idBill)]) {
            taxResults[String(idBill)] = [];
          }

          taxResults[String(idBill)].push({
            "subtype": subtype,
            "amount": amount,
            "lineUniqueKey": lineUniqueKey,
            "creditAccount": creditAccount,
            "reverseAccount": reverseAccount,
            "custSegments": custSegments,
            "strAccBooks": strAccBooks
          });

          if (!ACCOUNT_MAP[String(creditAccount)]) {
            ACCOUNT_MAP[String(creditAccount)] = creditAccount;
          }

          if (!ACCOUNT_MAP[String(reverseAccount)]) {
            ACCOUNT_MAP[String(reverseAccount)] = reverseAccount;
          }
        }
      }
    }
  }

  return taxResults;
}


function getBillValues(transactionRecord, customSegments) {
  var bills = {};
  var billIds = []
  var numApplieds = transactionRecord.getLineItemCount("apply");
  for (var i = 1; i <= numApplieds; i++) {
    var isApplied = transactionRecord.getLineItemValue("apply", "apply", i);
    if (isApplied == "T" || isApplied == true) {
      var internalid = transactionRecord.getLineItemValue("apply", "internalid", i);
      if (internalid && billIds.indexOf(Number(internalid)) == -1) {
        billIds.push(Number(internalid));
      }
    }
  }

  if (billIds.length) {
    var searchTransaction = nlapiLoadSearch("transaction", "customsearch_lmry_br_gl_standard_lines");
    searchTransaction.addFilter(new nlobjSearchFilter("internalid", null, "anyof", billIds));
    searchTransaction.addFilter(new nlobjSearchFilter("taxline", null, "is", "F"));
    searchTransaction.addFilter(new nlobjSearchFilter("account", null, "noneof", "@NONE@"));

    searchTransaction.addColumn(new nlobjSearchColumn("mainline"));
    searchTransaction.addColumn(new nlobjSearchColumn("fxamount"));
    searchTransaction.addColumn(new nlobjSearchColumn("account"));
    searchTransaction.addColumn(new nlobjSearchColumn("internalid").setSort(false));

    var segmentColumns = [];
    if (FEAT_DEPT == true || FEAT_DEPT == "T") {
      searchTransaction.addColumn(new nlobjSearchColumn("department"));
      segmentColumns.push("department");
    }

    if (FEAT_CLASS == true || FEAT_CLASS == "T") {
      searchTransaction.addColumn(new nlobjSearchColumn("class"));
      segmentColumns.push("class");
    }

    if (FEAT_LOC == true || FEAT_LOC == "T") {
      searchTransaction.addColumn(new nlobjSearchColumn("location"));
      segmentColumns.push("location");
    }

    for (var i = 0; i < customSegments.length; i++) {
      var segmentId = customSegments[i];
      searchTransaction.addColumn(new nlobjSearchColumn(segmentId));
      segmentColumns.push(segmentId);
    }

    var results = searchTransaction.runSearch().getResults(0, 1000);
    if (results && results.length) {
      for (var i = 0; i < results.length; i++) {
        var internalid = results[i].getValue("internalid");
        internalid = String(internalid);
        var mainLine = results[i].getValue("mainline");
        var lineuniquekey = results[i].getValue("lineuniquekey");
        lineuniquekey = String(lineuniquekey);
        var total = results[i].getValue("fxamount") || 0.00;

        if (!bills[internalid]) {
          bills[internalid] = {};
        }

        var billObj = {}
        if (mainLine == "*") {
          bills[internalid]["total"] = parseFloat(total);
          billObj = bills[internalid];
        } else {
          bills[internalid][lineuniquekey] = {};
          billObj = bills[internalid][lineuniquekey];
        }

        for (var s = 0; s < segmentColumns.length; s++) {
          var segmentId = segmentColumns[s];
          billObj[segmentId] = results[i].getValue(segmentId) || "";
        }
      }
    }
  }

  return bills
}