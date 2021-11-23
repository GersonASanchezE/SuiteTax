/**
 * Module Description
 *
 * Version    Date            Author           Remarks
 * 1.00       Jul 2018        LatamReady
 * File : LMRY_TransferenciaIVA_PLGN.js
 */
var objContext = nlapiGetContext();

var LMRY_script = 'LatamReady - Transferencia de IVA Plug-in';
var featureMB = false;
var featureLang = objContext.getPreference('LANGUAGE');
var featureLang = featureLang.substring(0, 2);
var featureSubs = false;
var fecha = '';
var subsidiary = '';
var jsonGlobalAM = {};

function customizeGlImpact(transactionRecord, standardLines, customLines, book) {

  try {

    var country = transactionRecord.getFieldText("custbody_lmry_subsidiary_country");
    if (country != '' && country != null) {
      country = country.substring(0, 3).toUpperCase();
    }
    country = country.substring(0, 1) + country.substring(2, 3);

    if (country != 'MX') {
      return true;
    }

    var licenses = getLicenses(transactionRecord.getFieldValue("subsidiary"));

    if (getAuthorization(243, licenses) == false) {
      return true;
    }

    //var idTransaction = transactionRecord.getId();
    fecha = transactionRecord.getFieldValue("trandate");
    featureSubs = objContext.getFeature('SUBSIDIARIES');
    if (featureSubs) {
      subsidiary = transactionRecord.getFieldValue("subsidiary");
    } else {
      subsidiary = transactionRecord.getFieldValue("custbody_lmry_subsidiary_country");
    }

    featureMB = objContext.getFeature('MULTIBOOK');

    var transactionType = transactionRecord.getRecordType().toLowerCase();
    switch (transactionType) {
      case 'customerpayment':
        filtroTransactionType = 1;
        break;
      case 'vendorpayment':
        filtroTransactionType = 8;
        break;
      default:
        return true;
    }

    var entity = '';

    //var estadoIVA = nlapiLookupField(transactionType, idTransaction, 'custbody_lmry_schedule_transfer_of_iva');

    var filtros = new Array();
    filtros[0] = new nlobjSearchFilter("isinactive", null, "is", ['F']);
    if (featureSubs) {
      filtros[1] = new nlobjSearchFilter("custrecord_lmry_setuptax_subsidiary", null, "is", [subsidiary]);
    }

    var columnas = new Array();

    if (transactionType == 'customerpayment') {
      entity = transactionRecord.getFieldValue("customer");
      columnas[0] = new nlobjSearchColumn("custrecord_lmry_setuptax_iva_debitsales");
      columnas[1] = new nlobjSearchColumn("custrecord_lmry_setuptax_iva_creditsales");
      columnas[2] = new nlobjSearchColumn("custrecord_lmry_setuptax_iva_earningsale");
      columnas[3] = new nlobjSearchColumn("custrecord_lmry_setuptax_iva_deficitsale");
    } else {
      entity = transactionRecord.getFieldValue("entity");
      columnas[0] = new nlobjSearchColumn("custrecord_lmry_setuptax_iva_debitpurch");
      columnas[1] = new nlobjSearchColumn("custrecord_lmry_setuptax_iva_creditpurch");
      columnas[2] = new nlobjSearchColumn("custrecord_lmry_setuptax_iva_earningpurc");
      columnas[3] = new nlobjSearchColumn("custrecord_lmry_setuptax_iva_deficitpurc");
    }
    columnas[4] = new nlobjSearchColumn("custrecord_lmry_setuptax_department");
    columnas[5] = new nlobjSearchColumn("custrecord_lmry_setuptax_class");
    columnas[6] = new nlobjSearchColumn("custrecord_lmry_setuptax_location");

    var searchSetupSubsidiary = nlapiCreateSearch("customrecord_lmry_setup_tax_subsidiary", filtros, columnas);
    var resultSearchSub = searchSetupSubsidiary.runSearch().getResults(0, 1000);

    var accountDebit = '';
    var accountCredit = '';
    var accEarningSetup = '';
    var accDeficitSetup = '';
    var estado = false;
    var lineBook = '';
    var lineRecord = '';
    var arrayWith = new Array();
    var arrayWithout = new Array();
    var indice0 = 0;
    var indice1 = 0;

    if (resultSearchSub.length != null && resultSearchSub.length > 0) {
      if (transactionType == 'customerpayment') {
        accountDebit = resultSearchSub[0].getValue("custrecord_lmry_setuptax_iva_debitsales");
        accountCredit = resultSearchSub[0].getValue("custrecord_lmry_setuptax_iva_creditsales");
        accEarningSetup = resultSearchSub[0].getValue("custrecord_lmry_setuptax_iva_earningsale");
        accDeficitSetup = resultSearchSub[0].getValue("custrecord_lmry_setuptax_iva_deficitsale");
      } else {
        accountDebit = resultSearchSub[0].getValue("custrecord_lmry_setuptax_iva_debitpurch");
        accountCredit = resultSearchSub[0].getValue("custrecord_lmry_setuptax_iva_creditpurch");
        accEarningSetup = resultSearchSub[0].getValue("custrecord_lmry_setuptax_iva_earningpurc");
        accDeficitSetup = resultSearchSub[0].getValue("custrecord_lmry_setuptax_iva_deficitpurc");
      }
      var departmentSetup = resultSearchSub[0].getValue("custrecord_lmry_setuptax_department");
      var classSetup = resultSearchSub[0].getValue("custrecord_lmry_setuptax_class");
      var locationSetup = resultSearchSub[0].getValue("custrecord_lmry_setuptax_location");

      //var accRevaluationSetup = resultSearchSub[0].getValue("custrecord_lmry_setuptax_iva_accrevaluat");

      if (accountDebit == '' || accountDebit == null || accountCredit == '' || accountCredit == null || accEarningSetup == '' || accEarningSetup == null || accDeficitSetup == '' || accDeficitSetup == null) {
        nlapiLogExecution("ERROR", "Mensaje", "Se deben configurar las cuentas");
        //nlapiSubmitField(transactionType, idTransaction, 'custbody_lmry_schedule_transfer_of_iva', '9');
        return true;
      }

      var accTransaccion = transactionRecord.getFieldValue("account");

      if (accTransaccion != '' && accTransaccion != null) {
        var filtros = new Array();
        filtros[0] = new nlobjSearchFilter('custrecord_lmry_account_no_transferiva', null, 'anyof', accTransaccion);
        filtros[1] = new nlobjSearchFilter('isinactive', null, 'is', 'F');

        var columnas = new Array();
        columnas[0] = new nlobjSearchColumn('internalid');

        var searchCuentas = nlapiSearchRecord('customrecord_lmry_account_no_transferiva', null, filtros, columnas);
        if (searchCuentas != null && searchCuentas != '') {
          // Marca la transaccion como excluida del proceso
          // nlapiSubmitField(transactionType, idTransaction, 'custbody_lmry_schedule_transfer_of_iva', '3');
          return true;
        }
      }

      // var filtros = new Array();
      // filtros[0] = new nlobjSearchFilter("isinactive", null, "is", ['F']);
      // filtros[1] = new nlobjSearchFilter("custrecord_lmry_gl_lines_plug_tran", null, "is", [idTransaction]);
      // if (featureMB) {
      //   filtros[2] = new nlobjSearchFilter("custrecord_lmry_gl_lines_plug_book", null, "is", [book.getId()]);
      // }

      // var columnas = new Array();
      // columnas[0] = new nlobjSearchColumn("internalid");
      // columnas[1] = new nlobjSearchColumn("custrecord_lmry_gl_lines_plug_line");

      // var searchStates = nlapiCreateSearch("customrecord_lmry_gl_lines_plug_state", filtros, columnas);
      // var resultSearchStates = searchStates.runSearch().getResults(0, 1000);

      var applySublist = transactionRecord.getLineItemCount('apply');

      //ARREGLO DE BILLS
      var transaccionPagar = [];

      for (var i = 1; i <= applySublist; i++) {
        var apply = transactionRecord.getLineItemValue('apply', 'apply', i);
        if (apply == 'T' || apply == true) {
          var lineID = transactionRecord.getLineItemValue('apply', 'doc', i);
          transaccionPagar.push(lineID);
        }
      }

      //nlapiLogExecution('ERROR','transaccionPagar',JSON.stringify(transaccionPagar));
      if(!transaccionPagar.length){
        return true;
      }


      //BUSQUEDA DE MX TRANSACTION FIELDS
      var filtrosMX = [];
      filtrosMX[0] = new nlobjSearchFilter("custrecord_lmry_mx_transaction_related", null, "anyof", transaccionPagar);
      filtrosMX[1] = new nlobjSearchFilter("isinactive", null, "is", ['F']);
      filtrosMX[2] = new nlobjSearchFilter("custrecord_lmry_mx_amount_save", null, "is", ['T']);
      filtrosMX[3] = new nlobjSearchFilter("mainline", "custrecord_lmry_mx_transaction_related", "is", ['T']);

      var columnasMX = new Array();
      columnasMX[0] = new nlobjSearchColumn("internalid");
      columnasMX[1] = new nlobjSearchColumn("custrecord_lmry_mx_amount_net");
      columnasMX[2] = new nlobjSearchColumn("custrecord_lmry_mx_amount_tax");
      columnasMX[3] = new nlobjSearchColumn("custrecord_lmry_mx_amount_total");
      columnasMX[4] = new nlobjSearchColumn("custrecord_lmry_mx_transaction_related");
      columnasMX[5] = new nlobjSearchColumn("transactionnumber", "CUSTRECORD_LMRY_MX_TRANSACTION_RELATED");
      columnasMX[6] = new nlobjSearchColumn("formulatext").setFormula("{custrecord_lmry_mx_transaction_related.tranid}");
      columnasMX[7] = new nlobjSearchColumn("exchangerate", "CUSTRECORD_LMRY_MX_TRANSACTION_RELATED");

      var searchMX = nlapiCreateSearch("customrecord_lmry_mx_transaction_fields", filtrosMX, columnasMX);
      var resultMX = searchMX.runSearch().getResults(0, 1000);

      //nlapiLogExecution('ERROR','resultMX',resultMX.length);

      if (resultMX.length == 0) {
        return true;
      }

      var jsonMX = {}, jsonMB = {}, contador = 0;

      if (resultMX != null && resultMX.length > 0) {
        var columMX = resultMX[0].getAllColumns();
        for (var i = 0; i < resultMX.length; i++) {
          var idBill = resultMX[i].getValue('custrecord_lmry_mx_transaction_related');
          if (jsonMX[idBill] == null || jsonMX[idBill] == undefined) {
            jsonMX[idBill] = { 'net': resultMX[i].getValue('custrecord_lmry_mx_amount_net'), 'total': resultMX[i].getValue('custrecord_lmry_mx_amount_total'), 'tax': resultMX[i].getValue('custrecord_lmry_mx_amount_tax'), 'tranid': resultMX[i].getValue(columMX[6]), 'transactionnumber': resultMX[i].getValue(columMX[5]), 'exchangerate': resultMX[i].getValue(columMX[7]) };
            contador++;
          }
        }
      }

      if (!parseFloat(contador) > 0) {
        return true;
      }

      //nlapiLogExecution('ERROR','jsonMX',JSON.stringify(jsonMX));
      //nlapiLogExecution('ERROR','Cantidad de bills',contador);

      //BUSQUEDA DE MULTIBOOKING
      if (featureMB) {
        var filtrosMB = [];
        filtrosMB[0] = new nlobjSearchFilter("internalid", null, "anyof", transaccionPagar);
        filtrosMB[1] = new nlobjSearchFilter("mainline", null, "is", 'T');

        var columnasMB = [];
        columnasMB[0] = new nlobjSearchColumn("internalid");
        columnasMB[1] = new nlobjSearchColumn("accountingbook", "accountingTransaction");
        columnasMB[2] = new nlobjSearchColumn("accountingbookid", "accountingTransaction");
        columnasMB[3] = new nlobjSearchColumn("exchangerate", "accountingTransaction");

        var searchMB = nlapiCreateSearch("transaction", filtrosMB, columnasMB);
        var resultMB = searchMB.runSearch().getResults(0, 1000);

        if (resultMB != null && resultMB.length > 0) {
          var columMB = resultMB[0].getAllColumns();
          for (var i = 0; i < resultMB.length; i++) {
            var idDoc = resultMB[i].getValue('internalid');

            if (jsonMB[idDoc] == null || jsonMB[idDoc] == undefined) {
              jsonMB[idDoc] = [];
            }

            jsonMB[idDoc].push({ 'book': resultMB[i].getText(columMB[1]), 'bookid': resultMB[i].getValue(columMB[2]), 'exchangerate': resultMB[i].getValue(columMB[3]) });

          }
        }

        //nlapiLogExecution('ERROR','jsonMB',JSON.stringify(jsonMB));

        //LLENADO DE JSON GLOBAL ACCOUNT MAPPING
        devolverCuentaGlobal();
        //nlapiLogExecution('ERROR','jsonGlobalAM',JSON.stringify(jsonGlobalAM));

      }


      //COMIENZO PAGO
      for (var i = 1; i <= applySublist; i++) {

        var apply = transactionRecord.getLineItemValue('apply', 'apply', i);

        if (apply == 'T' || apply == true) {

          var lineID = transactionRecord.getLineItemValue('apply', 'doc', i); // Internal ID del record

          //SI NO ESTA EL BILL EN EL JSON, NO GENERA SUITEGL
          if (jsonMX[lineID] == null || jsonMX[lineID] == undefined) {
            continue;
          }

          var lineType = transactionRecord.getLineItemValue('apply', 'trantype', i).toLowerCase(); // Tipo de Linea
          var linePaymentAmount = transactionRecord.getLineItemValue('apply', 'amount', i); // Monto

          var exchangeRate = 1;
          var taxamt = jsonMX[lineID]['tax'];
          var grossamt = jsonMX[lineID]['total'];
          var typeTransactionLine = '';
          var memo = '';

          exchangeRate = transactionRecord.getFieldValue('exchangerate');

          //nlapiLogExecution("ERROR", "lineID - lineType - linePaymentAmount", lineID + ' - ' + lineType + ' - ' + linePaymentAmount);

          switch (lineType) {
            case 'custinvc':
              typeTransactionLine = 'invoice';
              memo = 'Latam - IVA Transference Sales (Doc: ';

              break;
            case 'vendbill':
              typeTransactionLine = 'vendorbill';
              memo = 'Latam - IVA Transference Purchases (Doc: ';
              break;
            case 'exprept':
              typeTransactionLine = 'expensereport';
              memo = 'Latam - IVA Transference Expense Reports (Doc: ';
              break;
            default:
              continue;
          }

          var tranid = jsonMX[lineID]['tranid'];

          if (tranid == '' || tranid == null) {
            tranid = jsonMX[lineID]['transactionnumber'];
            if (tranid == '' || tranid == null) {
              tranid = lineID;
            }
          }

          memo = memo + tranid + ', ID: ' + lineID + ')';

          if (!taxamt) {
            continue;
          }

          taxamt = parseFloat(Math.round(parseFloat(taxamt) * 100) / 100);
          grossamt = parseFloat(Math.round(parseFloat(grossamt) * 100) / 100);
          if (exchangeRate == '' || exchangeRate == 0) {
            exchangerate = 1;
          }
          exchangeRate = parseFloat(Math.round(parseFloat(exchangeRate) * 100) / 100);

          //nlapiLogExecution("ERROR", "exchangeRate - taxamt - grossamt", exchangeRate + ' - ' + taxamt + ' - ' + grossamt);

          var percentaje = parseFloat(taxamt) / parseFloat(grossamt);
          var amountIVA = parseFloat(linePaymentAmount) * parseFloat(percentaje); // Monto de la Transaccion
          var amountIVAPayment = amountIVA;
          var revaluacionMoneda = 0;

          //nlapiLogExecution("ERROR", "percentaje - amountIVA", percentaje + ' - ' + amountIVA);

          if (amountIVA == 0 || amountIVA == '') {
            //nlapiSubmitField(typeTransactionLine, lineID, 'custbody_lmry_schedule_transfer_of_iva', '4');
            // if (featureMB) {
            //   agregarLineaRecord(resultSearchStates, idTransaction, lineID, '4', book.getId());
            // } else {
            //   agregarLineaRecord(resultSearchStates, idTransaction, lineID, '4', '');
            // }
            //nlapiLogExecution("ERROR", "Mensaje", "No tiene Monto IVA");
            continue;
          }

          var prefDep = objContext.getPreference('DEPTMANDATORY');
          var prefLoc = objContext.getPreference('LOCMANDATORY');
          var prefClas = objContext.getPreference('CLASSMANDATORY');
          var departmentLine = '';
          var classLine = '';
          var locationLine = '';
          var contadorSeg = parseInt(0);

          if (prefDep == 'T' || prefDep == true) {
            departmentLine = elegirSegmentacion(transactionRecord.getFieldValue("department"), departmentSetup);
            if (departmentLine == '' || departmentLine == null) {
              contadorSeg = contadorSeg + 1;
            }
          }

          if (prefClas == 'T' || prefClas == true) {
            classLine = elegirSegmentacion(transactionRecord.getFieldValue("class"), classSetup);
            if (classLine == '' || classLine == null) {
              contadorSeg = contadorSeg + 1;
            }
          }

          if (prefLoc == 'T' || prefLoc == true) {
            locationLine = elegirSegmentacion(transactionRecord.getFieldValue("location"), locationSetup);
            if (locationLine == '' || locationLine == null) {
              contadorSeg = contadorSeg + 1;
            }
          }

          //nlapiLogExecution('ERROR','contadorSeg',contadorSeg);

          if (contadorSeg > 0) {
            if (featureLang == 'es') {
              sendemail(' [ customizeGlImpact ] ' + 'La Segmentacion (Clase, Departamento o Localidad) han sido configurados obligatorios en Preferencias de Contabilidad y no se encuentran configurados en el formulario, por lo tanto debe registrarlos en la ruta Setup > LatamReady - Setup > LatamReady - Setup Tax Subsi.', LMRY_script);
              break;
            } else {
              sendemail(' [ customizeGlImpact ] ' + 'The Segmentation (Class, Department or Location) have been configured as mandatory in Accounting Preferences and have not been configured in the form, therefore you must configure them in the path Setup > LatamReady - Setup > LatamReady - Setup Tax Subsi.', LMRY_script);
              break;
            }
          }

          if (featureMB) {
            amountIVA = tipoCambioMB(jsonMB[lineID], book, amountIVA, jsonMX[lineID]['exchangerate'], '1');
            amountIVAPayment = tipoCambioMB(transactionRecord, book, amountIVAPayment, exchangeRate, '0');
          } else {
            var exRateLine = jsonMX[lineID]['exchangerate'];
            var exRateTrans = transactionRecord.getFieldValue("exchangerate");

            if (exRateLine) {
              amountIVA = amountIVA * parseFloat(exRateLine);
              amountIVA = parseFloat(Math.round(parseFloat(amountIVA) * 100) / 100);
            }

            if (exRateTrans) {
              amountIVAPayment = amountIVAPayment * parseFloat(exRateTrans);
              amountIVAPayment = parseFloat(Math.round(parseFloat(amountIVAPayment) * 100) / 100);
            }
          }

          if (amountIVA != amountIVAPayment) {
            revaluacionMoneda = parseFloat(amountIVA) - parseFloat(amountIVAPayment);
            revaluacionMoneda = Math.abs(revaluacionMoneda);
            revaluacionMoneda = parseFloat(Math.round(parseFloat(revaluacionMoneda) * 100) / 100);
            //nlapiLogExecution("ERROR", " amountIVA - amountIVAPayment - revaluacionMoneda", amountIVA + ' - ' + amountIVAPayment + ' - ' + revaluacionMoneda);
          }

          var montoDebit, montoCredit;

          if (transactionType == 'customerpayment') { // Customer Payment
            montoDebit = amountIVA;
            montoCredit = amountIVAPayment;
          } else { // Bill Payment
            montoDebit = amountIVAPayment;
            montoCredit = amountIVA;
          }

          //nlapiLogExecution("ERROR", "montoDebit - montoCredit", montoDebit + ' - ' + montoCredit);

          if (montoDebit <= 0 || montoCredit <= 0) {
            continue;
          }

          // Cuenta dependiendo del Libro Contable
          if (!book.isPrimary()) {
            accountDebit = devolverCuenta(accountDebit, book.getId());
            accountCredit = devolverCuenta(accountCredit, book.getId());
          }

          var newLineDebit = customLines.addNewLine();
          newLineDebit.setDebitAmount(parseFloat(montoDebit));
          newLineDebit.setAccountId(parseFloat(accountDebit));
          newLineDebit.setMemo(memo);
          if (departmentLine != '' && departmentLine != null) {
            newLineDebit.setDepartmentId(parseInt(departmentLine));
          }
          if (classLine != '' && classLine != null) {
            newLineDebit.setClassId(parseInt(classLine));
          }
          if (locationLine != '' && locationLine != null) {
            newLineDebit.setLocationId(parseInt(locationLine));
          }
          newLineDebit.setEntityId(parseInt(entity));

          var newLineCredit = customLines.addNewLine();
          newLineCredit.setCreditAmount(parseFloat(montoCredit));
          newLineCredit.setAccountId(parseFloat(accountCredit));
          newLineCredit.setMemo(memo);
          if (departmentLine != '' && departmentLine != null) {
            newLineCredit.setDepartmentId(parseInt(departmentLine));
          }
          if (classLine != '' && classLine != null) {
            newLineCredit.setClassId(parseInt(classLine));
          }
          if (locationLine != '' && locationLine != null) {
            newLineCredit.setLocationId(parseInt(locationLine));
          }
          newLineCredit.setEntityId(parseInt(entity));

          // Linea de Revaluacion de Moneda
          if (revaluacionMoneda > 0) {
            // Cuenta dependiendo del Libro Contable
            if (!book.isPrimary()) {
              accDeficitSetup = devolverCuenta(accDeficitSetup, book.getId());
              accEarningSetup = devolverCuenta(accEarningSetup, book.getId());
            }
            var memoRevaluation = '';
            if (featureLang == 'es') {
              memoRevaluation = 'Latam - Revaluacion de Moneda (Doc: ' + tranid + ')';
            } else {
              memoRevaluation = 'Latam - Currency Revaluation (Doc: ' + tranid + ')';
            }
            if (parseFloat(montoDebit) > parseFloat(montoCredit)) { // Credito Total es Menor que el Debito Total
              var newLineCredit = customLines.addNewLine();
              newLineCredit.setCreditAmount(parseFloat(revaluacionMoneda));
              newLineCredit.setAccountId(parseFloat(accDeficitSetup));
              newLineCredit.setMemo(memoRevaluation);
              if (departmentLine != '' && departmentLine != null) {
                newLineCredit.setDepartmentId(parseInt(departmentLine));
              }
              if (classLine != '' && classLine != null) {
                newLineCredit.setClassId(parseInt(classLine));
              }
              if (locationLine != '' && locationLine != null) {
                newLineCredit.setLocationId(parseInt(locationLine));
              }
              newLineCredit.setEntityId(parseInt(entity));
            } else { // Credito Total es Mayor que el Debito Total

              var newLineDebit = customLines.addNewLine();
              newLineDebit.setDebitAmount(parseFloat(revaluacionMoneda));
              newLineDebit.setAccountId(parseFloat(accEarningSetup));
              newLineDebit.setMemo(memoRevaluation);
              if (departmentLine != '' && departmentLine != null) {
                newLineDebit.setDepartmentId(parseInt(departmentLine));
              }
              if (classLine != '' && classLine != null) {
                newLineDebit.setClassId(parseInt(classLine));
              }
              if (locationLine != '' && locationLine != null) {
                newLineDebit.setLocationId(parseInt(locationLine));
              }
              newLineDebit.setEntityId(parseInt(entity));
            }
          }

          //nlapiSubmitField(typeTransactionLine, lineID, 'custbody_lmry_schedule_transfer_of_iva', '1');
          // if (featureMB) {
          //   agregarLineaRecord(resultSearchStates, idTransaction, lineID, '1', book.getId());
          // } else {
          //   agregarLineaRecord(resultSearchStates, idTransaction, lineID, '1', '');
          // }
          estado = true;
        }
      }

      //var estadoIVA = nlapiLookupField(transactionType, idTransaction, 'custbody_lmry_schedule_transfer_of_iva');
      //nlapiLogExecution('ERROR', 'estadoIVA', estadoIVA);

      // if (estadoIVA == '8' || estadoIVA == '2') {
      //   if (estado == true) {
      //     nlapiSubmitField(transactionType, idTransaction, 'custbody_lmry_schedule_transfer_of_iva', '1');
      //     return true;
      //     //nlapiLogExecution("ERROR", "Mensaje", "Proceso Completo");
      //   } else {
      //     nlapiSubmitField(transactionType, idTransaction, 'custbody_lmry_schedule_transfer_of_iva', '2');
      //     return true;
      //     //nlapiLogExecution("ERROR", "Mensaje", "No se genero");
      //   }
      // }

    } else {
      //nlapiSubmitField(transactionType, idTransaction, 'custbody_lmry_schedule_transfer_of_iva', '9');
      //nlapiLogExecution("ERROR", "Mensaje", "Se deben configurar el Setup Tax Subsidiary");
      return true;
    }

    var usageRemaining = objContext.getRemainingUsage();
    nlapiLogExecution("ERROR", "Uso de memoria", usageRemaining);

    //nlapiLogExecution('ERROR', 'estadoIVA 2', estadoIVA);

    // if (estadoIVA == '8' || estadoIVA == '2') {
    //   nlapiSubmitField(transactionType, idTransaction, 'custbody_lmry_schedule_transfer_of_iva', '2');
    // }

  } catch (err) {
    //nlapiLogExecution('ERROR', 'customizeGlImpact', err);
    sendemail(' [ customizeGlImpact ] ' + err, LMRY_script);
  }
}

function tipoCambioMB(transactionRecordAux, book, ivaMB, exchange, flow) {

  try {

    var exchangeRate_mb = 1;

    if (book.isPrimary()) {
      exchangeRate_mb = exchange;
    } else {

      var bookId = book.getId();

      //TRANSACTION RECORD DEL MISMO SCRIPT
      if (flow == '0') {
        for (var line = 1; line <= transactionRecordAux.getLineItemCount('accountingbookdetail'); line++) {
          if (bookId == transactionRecordAux.getLineItemValue('accountingbookdetail', 'bookid', line)) {
            exchangeRate_mb = transactionRecordAux.getLineItemValue('accountingbookdetail', 'exchangerate', line);
            //nlapiLogExecution('ERROR', 'exchangeRate_mb2', exchangeRate_mb);
            break;
          }
        }

      } else {
        //NUEVO: JSON DE BUSQUEDA MULTIBOOKING
        for (var line = 0; line < transactionRecordAux.length; line++) {
          if (bookId == transactionRecordAux[line]['bookid']) {
            exchangeRate_mb = transactionRecordAux[line]['exchangerate'];
            break;
          }
        }

      }

    }

    if (exchangeRate_mb == '' || exchangeRate_mb == null) {
      exchangeRate_mb = 1;
    }
    ivaMB = ivaMB * parseFloat(exchangeRate_mb);
    ivaMB = parseFloat(Math.round(parseFloat(ivaMB) * 100) / 100);


  } catch (err) {
    nlapiLogExecution('ERROR', 'tipoCambioMB', err);
    //sendemail(' [ tipoCambioMB ] ' + err, LMRY_script);
    throw ' [ tipoCambioMB ] ' + err;
  }

  return ivaMB;
}

function devolverCuentaGlobal() {
  var filtros_gam = [];
  filtros_gam[0] = new nlobjSearchFilter('effectivedate', null, 'onorbefore', fecha);
  if (featureSubs) {
    filtros_gam[1] = new nlobjSearchFilter('subsidiary', null, 'anyof', subsidiary);
  }

  var columnas_gam = [];
  columnas_gam[0] = new nlobjSearchColumn("internalid");
  columnas_gam[1] = new nlobjSearchColumn("destinationaccount");
  columnas_gam[2] = new nlobjSearchColumn("enddate");
  columnas_gam[3] = new nlobjSearchColumn("sourceaccount");
  columnas_gam[4] = new nlobjSearchColumn("accountingbook");

  var search_gam = nlapiCreateSearch('globalaccountmapping', filtros_gam, columnas_gam);
  var result_gam = search_gam.runSearch().getResults(0, 1000);

  for (var m = 0; m < result_gam.length; m++) {
    var fechaFinAcc = result_gam[m].getValue("enddate");
    var sourceAccount = result_gam[m].getValue("sourceaccount");
    var currentBook = result_gam[m].getValue("accountingbook");

    if (fechaFinAcc == '' || fechaFinAcc == null) {
      jsonGlobalAM[sourceAccount + ";" + currentBook] = result_gam[m].getValue('destinationaccount');
    } else {
      if (yyymmdd(fecha) <= yyymmdd(fechaFinAcc)) {
        jsonGlobalAM[sourceAccount + ";" + currentBook] = result_gam[m].getValue('destinationaccount');
      }
    }
  }


}

function devolverCuenta(cuentaSource, currentBook) {

  try {

    if (jsonGlobalAM[cuentaSource + ";" + currentBook] != null && jsonGlobalAM[cuentaSource + ";" + currentBook] != undefined) {
      return jsonGlobalAM[cuentaSource + ";" + currentBook];
    } else {
      return cuentaSource;
    }

  } catch (err) {
    nlapiLogExecution('ERROR', 'devolverCuenta', err);
    //sendemail(' [ devolverCuenta ] ' + err, LMRY_script);
    throw ' [ devolverCuenta ] ' + err;
  }
}

function elegirSegmentacion(valor1, valor2, tipo) {
  try {
    if (valor1 != '' && valor1 != null) {
      return valor1;
    } else {
      if (valor2 != '' && valor2 != null) {
        return valor2;
      }
    }
  } catch (err) {
    //sendemail(' [ elegirSegmentacion ] ' + err, LMRY_script);
    nlapiLogExecution('ERROR', 'elegirSegmentacion', err);
    throw ' [ elegirSegmentacion ] ' + err;
  }
  return '';
}

// function agregarLineaRecord(resultSearchStates, idTransaction, lineID, statusLine, bookLine) {
//   try {

//     var blnAdd = false;

//     if (resultSearchStates != '' && resultSearchStates.length > 0) {

//       for (var indice = 0; indice < resultSearchStates.length; indice++) {
//         var internalId_Status = resultSearchStates[indice].getValue('internalid');
//         var lineID_Status = resultSearchStates[indice].getValue('custrecord_lmry_gl_lines_plug_line');
//         if (lineID_Status == lineID) {
//           nlapiSubmitField('customrecord_lmry_gl_lines_plug_state', internalId_Status, 'custrecord_lmry_gl_lines_plug_schdl', '2');
//           blnAdd = true;
//           break;
//         }
//       }

//       if (blnAdd == false) {
//         var recordLines = nlapiCreateRecord('customrecord_lmry_gl_lines_plug_state', false);
//         recordLines.setFieldValue('custrecord_lmry_gl_lines_plug_tran', idTransaction);
//         recordLines.setFieldValue('custrecord_lmry_gl_lines_plug_line', lineID);
//         recordLines.setFieldValue('custrecord_lmry_gl_lines_plug_stat', statusLine);
//         if (featureMB) {
//           recordLines.setFieldValue('custrecord_lmry_gl_lines_plug_book', bookLine);
//         }
//         recordLines.setFieldValue('custrecord_lmry_gl_lines_plug_schdl', '2');
//         nlapiSubmitRecord(recordLines, true, true);
//       }

//     } else {
//       var recordLines = nlapiCreateRecord('customrecord_lmry_gl_lines_plug_state', false);
//       recordLines.setFieldValue('custrecord_lmry_gl_lines_plug_tran', idTransaction);
//       recordLines.setFieldValue('custrecord_lmry_gl_lines_plug_line', lineID);
//       recordLines.setFieldValue('custrecord_lmry_gl_lines_plug_stat', statusLine);
//       if (featureMB) {
//         recordLines.setFieldValue('custrecord_lmry_gl_lines_plug_book', bookLine);
//       }
//       recordLines.setFieldValue('custrecord_lmry_gl_lines_plug_schdl', '2');
//       nlapiSubmitRecord(recordLines, true, true);
//     }

//   } catch (err) {
//     sendemail(' [ agregarLineaRecord ] ' + err, LMRY_script);
//   }
// }

/***********************************************
 * Funcion que da formato al campo fecha YYMMDD
 * Parámetros :
 *      date : fecha
 **********************************************/
function yyymmdd(dateString) {

  if (dateString == '' || dateString == null) {
    return '';
  }

  var date = new Date(dateString);

  var year = date.getFullYear();

  var month = "" + (date.getMonth() + 1);

  if (month.length < 2)
    month = "0" + month;

  var date = "" + date.getDate();
  if (date.length < 2)
    date = "0" + date;

  var fe = '' + year + "" + month + "" + date;

  return fe;
}
