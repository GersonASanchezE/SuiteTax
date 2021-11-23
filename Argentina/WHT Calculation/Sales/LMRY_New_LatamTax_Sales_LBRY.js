/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_New_LatamTax_Sales_LBRY.js  				        ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Oct 27 2020  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */
define(['N/ui/serverWidget','N/search','N/runtime','N/record','N/log','N/url','N/format','../Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],

function(serverWidget,search, runtime, record, log, url, format, libraryEmail) {
    //FEATURES
    var fMultPrice = runtime.isFeatureInEffect({feature: 'MULTPRICE'});

    //JSON GLOBALES
    var jsonLog = {};
    var jsonSetupTax = {};
    var jsonMultibooking = {};
    var jsonAcumulado = {};
    var jsonLastRetentionCC = {};
    var jsonLastRetentionNT = {};
    var jsonCM = {};
    var jsonInvoices = {};
    var jsonAllInvoice = {};
    var jsonPaymentActual = {'exento': 0, 'iva': 0, 'gravado': 0, 'nogravado': 0, 'total': 0, 'graynogra': 0};
    var resultCC;
    var resultNT;
    var arrayFinal = [];
    var jsonBanderas = {'minimo': false, 'acumulado': false, 'maximo': false, 'dobase': false, 'noimponible': false, 'setbase': false, 'lastretention': false, 'addaccumulated': false, 'minimumretention': false};

    //VARIABLES GLOBALES
    var exchangeAR = 1;
    var sumaPagos = 0;
    var orden = 1;
    var primerInvoice = '';

    function getSalesLog(searchLog, script){

      if(script == 0){
        jsonLog['subsidiary'] = searchLog.custrecord_lmry_new_latamtax_subsidiary[0].value;
        jsonLog['customer'] = searchLog.custrecord_lmry_new_latamtax_customer[0].value;
        jsonLog['customerText'] = searchLog.custrecord_lmry_new_latamtax_customer[0].text;
        jsonLog['currency'] = searchLog.custrecord_lmry_new_latamtax_currency[0].value;
        jsonLog['period'] = searchLog.custrecord_lmry_new_latamtax_period[0].value;
        jsonLog['method'] = searchLog.custrecord_lmry_new_latamtax_method[0].value;
        jsonLog['aracct'] = searchLog.custrecord_lmry_new_latamtax_araccount[0].value;

        if(searchLog['custrecord_lmry_new_latamtax_department'].length){
          jsonLog['department'] = searchLog.custrecord_lmry_new_latamtax_department[0].value;
        }

        if(searchLog['custrecord_lmry_new_latamtax_class'].length){
          jsonLog['class'] = searchLog.custrecord_lmry_new_latamtax_class[0].value;
        }

        if(searchLog['custrecord_lmry_new_latamtax_location'].length){
          jsonLog['location'] = searchLog.custrecord_lmry_new_latamtax_location[0].value;
        }

        if(searchLog['custrecord_lmry_new_latamtax_bank'].length){
          jsonLog['bank'] = searchLog.custrecord_lmry_new_latamtax_bank[0].value;
        }

      }else{
        jsonLog['subsidiary'] = searchLog.custrecord_lmry_new_latamtax_subsidiary.value;
        jsonLog['customer'] = searchLog.custrecord_lmry_new_latamtax_customer.value;
        jsonLog['customerText'] = searchLog.custrecord_lmry_new_latamtax_customer.text;
        jsonLog['currency'] = searchLog.custrecord_lmry_new_latamtax_currency.value;
        jsonLog['period'] = searchLog.custrecord_lmry_new_latamtax_period.value;
        jsonLog['method'] = searchLog.custrecord_lmry_new_latamtax_method.value;
        jsonLog['aracct'] = searchLog.custrecord_lmry_new_latamtax_araccount.value;

        if(JSON.stringify(searchLog['custrecord_lmry_new_latamtax_department']) != '{}'){
          jsonLog['department'] = searchLog.custrecord_lmry_new_latamtax_department.value;
        }

        if(JSON.stringify(searchLog['custrecord_lmry_new_latamtax_class']) != '{}'){
          jsonLog['class'] = searchLog.custrecord_lmry_new_latamtax_class.value;
        }

        if(JSON.stringify(searchLog['custrecord_lmry_new_latamtax_location']) != '{}'){
          jsonLog['location'] = searchLog.custrecord_lmry_new_latamtax_location.value;
        }

        if(JSON.stringify(searchLog['custrecord_lmry_new_latamtax_bank']) != '{}'){
          jsonLog['bank'] = searchLog.custrecord_lmry_new_latamtax_bank.value;
        }

        jsonLog['noretention'] = searchLog.custrecord_lmry_new_latamtax_noretention;
        jsonLog['edited'] = searchLog.custrecord_lmry_new_latamtax_edited;

      }

      jsonLog['check'] = searchLog.custrecord_lmry_new_latamtax_check;
      jsonLog['memo'] = searchLog.custrecord_lmry_new_latamtax_memo;
      jsonLog['multibooking'] = searchLog.custrecord_lmry_new_latamtax_multibook;
      jsonLog['rate'] = searchLog.custrecord_lmry_new_latamtax_rate;
      jsonLog['date'] = searchLog.custrecord_lmry_new_latamtax_date;
      jsonLog['invoices'] = searchLog.custrecord_lmry_new_latamtax_invoices;

      log.debug('jsonLog',JSON.stringify(jsonLog));

    }

    function getAccumulated(customers, script, periodo, subsidiary, fecha){
      //ACUMULADO: PAGOS ANTERIORES

      if(script == 0){
        jsonAcumulado[customers] = {'gravado': 0, 'nogravado': 0, 'exento': 0, 'iva': 0,'total': 0, 'graynogra': 0};
        jsonLastRetentionCC[customers] = {};
        jsonLastRetentionNT[customers] = {};
      }

      var filtrosAcumulado = [];
      filtrosAcumulado[0] = search.createFilter({name: 'custrecord_lmry_new_latamtax_customer', operator: 'anyof', values: customers});
      filtrosAcumulado[1] = search.createFilter({name: 'custrecord_lmry_new_latamtax_status', operator: 'is', values: ['Finalizado']});
      filtrosAcumulado[2] = search.createFilter({name: 'custrecord_lmry_new_latamtax_period', operator: 'is', values: periodo});
      filtrosAcumulado[3] = search.createFilter({name: 'custrecord_lmry_new_latamtax_payment', operator: 'noneof', values: ['@NONE@']});
      filtrosAcumulado[4] = search.createFilter({name: 'custrecord_lmry_new_latamtax_subsidiary', operator: 'is', values: subsidiary});

      var searchAcumulado = search.create({type: 'customrecord_lmry_new_latamtax_sales_log', filters: filtrosAcumulado,
      columns: ['custrecord_lmry_new_latamtax_invoices','custrecord_lmry_new_latamtax_accumulated','custrecord_lmry_new_latamtax_customer']});

      var resultAcumulado = searchAcumulado.run().getRange({start:0,end:1000});

      if(resultAcumulado != null && resultAcumulado.length > 0){
        for(var i = 0; i < resultAcumulado.length; i++){
          var customer = resultAcumulado[i].getValue('custrecord_lmry_new_latamtax_customer');

          /*if(jsonAcumulado[customer] == null || jsonAcumulado[customer] == undefined){
            jsonAcumulado[customer] = {'gravado': 0, 'nogravado': 0, 'exento': 0, 'iva': 0,'total': 0, 'graynogra': 0};
          }*/

          var accumulated = JSON.parse(resultAcumulado[i].getValue('custrecord_lmry_new_latamtax_accumulated'));

          jsonAcumulado[customer]['gravado'] += parseFloat(accumulated['gravado']);
          jsonAcumulado[customer]['nogravado'] += parseFloat(accumulated['nogravado']);
          jsonAcumulado[customer]['exento'] += parseFloat(accumulated['exento']);
          jsonAcumulado[customer]['iva'] += parseFloat(accumulated['iva']);
          jsonAcumulado[customer]['total'] += parseFloat(accumulated['total']);
          jsonAcumulado[customer]['total'] = Math.round(parseFloat(jsonAcumulado[customer]['total']) * 1000000)/1000000;
          jsonAcumulado[customer]['graynogra'] += parseFloat(accumulated['graynogra']);

        }
      }

      log.debug('jsonAcumulado',JSON.stringify(jsonAcumulado));

      //BUSQUEDA PAGO ANTERIOR: DETAILS
      var searchDetails = search.create({type:'customrecord_lmry_wht_details',filters:[
        {name:'trandate',join:'custrecord_lmry_wht_bill_payment',operator:'onorbefore',values: fecha},
        {name:'postingperiod',join:'custrecord_lmry_wht_bill_payment',operator:'abs',values: periodo},
        {name:'mainline',join:'custrecord_lmry_wht_bill_payment',operator:'is',values:'T'},
        {name:'custrecord_lmry_whtdet_vendor',operator:'anyof',values: customers},
        {name:'subsidiary',join:'custrecord_lmry_wht_bill_payment',operator:'is',values: subsidiary},
        {name:'custrecord_lmry_whtdet_voided', operator: 'noneof', values: '1'}
      ],
      columns:[{name:'internalid',sort:search.Sort.DESC},'custrecord_lmry_wht_bill_payment','custrecord_lmry_whtdet_contribclass','custrecord_lmry_wht_nationaltax',
      'custrecord_lmry_whtdet_amount',{name:'custrecord_lmry_ar_trans_paid_exc',join:'custrecord_lmry_wht_voucher'},{name:'currency',join:'custrecord_lmry_wht_bill_payment'},
      {name:'custrecord_lmry_ar_witaxamt',join:'custrecord_lmry_wht_voucher'}, 'custrecord_lmry_whtdet_vendor']
      });

      var resultDetails = searchDetails.run().getRange({start:0,end:1000});

      if(resultDetails != null && resultDetails.length > 0){
        var columnsDetails = resultDetails[0].columns;
        for(var i = 0; i < resultDetails.length; i++){
          var customerDetails = resultDetails[i].getValue(columnsDetails[8]);
          var retencionAnterior = resultDetails[i].getValue(columnsDetails[7]);

          var cclPago = resultDetails[i].getValue(columnsDetails[2]);
          var ntPago = resultDetails[i].getValue(columnsDetails[3]);

          if(cclPago){
            if(jsonLastRetentionCC[customerDetails][cclPago] == null || jsonLastRetentionCC[customerDetails][cclPago] == undefined){
              jsonLastRetentionCC[customerDetails][cclPago] = 0;
            }

            jsonLastRetentionCC[customerDetails][cclPago] += parseFloat(retencionAnterior);

          }else{
            if(jsonLastRetentionNT[customerDetails][ntPago] == null || jsonLastRetentionCC[customerDetails][ntPago] == undefined){
              jsonLastRetentionNT[customerDetails][ntPago] = 0;
            }

            jsonLastRetentionNT[customerDetails][ntPago] += parseFloat(retencionAnterior);
          }


        }
      }

      //log.debug('jsonLastRetentionCC',JSON.stringify(jsonLastRetentionCC));
      //log.debug('jsonLastRetentionNT',JSON.stringify(jsonLastRetentionNT));


    }

    function basesAllInvoice(allInvoices){

      var searchInvoice = search.create({type: 'invoice', filters: [{name: 'internalid', operator: 'anyof', values: allInvoices}, {name: 'mainline', operator: 'is', values: 'T'}],
      columns: ['internalid','entity', {name: 'formulatext', formula: '{tranid}'}, {name: "custrecord_lmry_transaction_f_exento", join: "CUSTRECORD_LMRY_TRANSACTION_F"}, {name: "custrecord_lmry_transaction_f_iva", join: "CUSTRECORD_LMRY_TRANSACTION_F"},
      {name: "custrecord_lmry_transaction_f_gravado", join: "CUSTRECORD_LMRY_TRANSACTION_F"}, {name: "custrecord_lmry_transaction_f_no_gravado", join: "CUSTRECORD_LMRY_TRANSACTION_F"}, 'custbody_lmry_tipo_renta', 'fxamount']
      });

      var resultInvoice = searchInvoice.run().getRange({start: 0, end: 1000});
      var columnsInvoice = resultInvoice[0].columns;

      for(var i = 0; i < resultInvoice.length; i++){
        var idInvoice = resultInvoice[i].getValue(columnsInvoice[0]);
        jsonAllInvoice[idInvoice] = {'customer': resultInvoice[i].getValue(columnsInvoice[1]), 'tranid': resultInvoice[i].getValue(columnsInvoice[2]), 'renta': resultInvoice[i].getValue(columnsInvoice[7])}

        jsonAllInvoice[idInvoice]['exento'] = resultInvoice[i].getValue(columnsInvoice[3]) || 0;
        jsonAllInvoice[idInvoice]['iva'] = resultInvoice[i].getValue(columnsInvoice[4]) || 0;
        jsonAllInvoice[idInvoice]['gravado'] = resultInvoice[i].getValue(columnsInvoice[5]) || 0;
        jsonAllInvoice[idInvoice]['nogravado'] = resultInvoice[i].getValue(columnsInvoice[6]) || 0;
        jsonAllInvoice[idInvoice]['graynogra'] = parseFloat(jsonAllInvoice[idInvoice]['gravado']) + parseFloat(jsonAllInvoice[idInvoice]['nogravado']);
        jsonAllInvoice[idInvoice]['total'] = resultInvoice[i].getValue(columnsInvoice[8]);

      }

      //log.debug('jsonAllInvoice',JSON.stringify(jsonAllInvoice));

    }

    function creditMemo(customer){

      jsonInvoices = JSON.parse(jsonLog['invoices']);

      for(var i in jsonInvoices){
        sumaPagos += parseFloat(jsonInvoices[i]['payment']);
        var auxTotal = jsonInvoices[i]['total'];

        if(jsonInvoices[i]['totalcm'] != null && jsonInvoices[i]['totalcm'] != undefined){

          jsonCM[i] = {'total': jsonInvoices[i]['totalcm'], 'gravado': jsonInvoices[i]['gravado'], 'nogravado': jsonInvoices[i]['nogravado'],
                      'exento': jsonInvoices[i]['exento'], 'iva': jsonInvoices[i]['iva'], 'graynogra': jsonInvoices[i]['graynogra']};

          auxTotal = parseFloat(auxTotal) - parseFloat(jsonInvoices[i]['totalcm']);
        }

        jsonInvoices[i]['porcetpago'] = parseFloat(jsonInvoices[i]['payment']) / parseFloat(auxTotal);

      }

      //log.debug('jsonCM',JSON.stringify(jsonCM));

      //RESTA DE INVOICE ACTUAL Y CM
      for(var i in jsonCM){
        jsonAllInvoice[i]['exento'] -= parseFloat(jsonCM[i]['exento']);
        jsonAllInvoice[i]['iva']  -= parseFloat(jsonCM[i]['iva']);
        jsonAllInvoice[i]['gravado'] -= parseFloat(jsonCM[i]['gravado']);
        jsonAllInvoice[i]['nogravado'] -= parseFloat(jsonCM[i]['nogravado']);
        jsonAllInvoice[i]['total'] -= parseFloat(jsonCM[i]['total']);
        jsonAllInvoice[i]['graynogra'] -= parseFloat(jsonCM[i]['graynogra']);
      }

      for(var i in jsonAllInvoice){
        jsonAllInvoice[i]['exento'] *= parseFloat(jsonInvoices[i]['porcetpago']);
        jsonAllInvoice[i]['iva'] *= parseFloat(jsonInvoices[i]['porcetpago']);
        jsonAllInvoice[i]['gravado'] *= parseFloat(jsonInvoices[i]['porcetpago']);
        jsonAllInvoice[i]['nogravado'] *= parseFloat(jsonInvoices[i]['porcetpago']);
        jsonAllInvoice[i]['total'] *= parseFloat(jsonInvoices[i]['porcetpago']);
        jsonAllInvoice[i]['graynogra'] *= parseFloat(jsonInvoices[i]['porcetpago']);
      }


      //log.debug('jsonAllInvoice Def',JSON.stringify(jsonAllInvoice));

      //ACUMULADO DE PAGO ACTUAL
      for(var i in jsonAllInvoice){

        var auxCustomer = jsonAllInvoice[i]['customer'];

        if(customer != auxCustomer){
          continue;
        }

        jsonPaymentActual['exento'] += parseFloat(jsonAllInvoice[i]['exento']);
        jsonPaymentActual['iva'] += parseFloat(jsonAllInvoice[i]['iva']);
        jsonPaymentActual['gravado'] += parseFloat(jsonAllInvoice[i]['gravado']);
        jsonPaymentActual['nogravado'] += parseFloat(jsonAllInvoice[i]['nogravado']);
        jsonPaymentActual['total'] += parseFloat(jsonAllInvoice[i]['total']);
        jsonPaymentActual['graynogra'] += parseFloat(jsonAllInvoice[i]['graynogra']);

      }

      log.debug('jsonPaymentActual',JSON.stringify(jsonPaymentActual));

    }

    function ccynt(customers, fecha, subsidiary){

      var columnasNT = ['custrecord_lmry_ntax_taxitem','custrecord_lmry_ntax_taxrate','internalid','custrecord_lmry_ntax_addratio','custrecord_lmry_ntax_jurisdib', //4
      'custrecord_lmry_ntax_appliesto','custrecord_lmry_ntax_amount','custrecord_lmry_ntax_sub_type','custrecord_lmry_ntax_minamount','custrecord_lmry_ntax_montaccum', //9
      'custrecord_lmry_ntax_taxrate_pctge','custrecord_lmry_ntax_fiscal_doctype','custrecord_lmry_ntax_accandmin_with','custrecord_lmry_ntax_maxamount',
      'custrecord_lmry_ntax_set_baseretention','custrecord_lmry_ntax_applies_to_item','custrecord_lmry_ntax_applies_to_account','custrecord_lmry_ntax_subtype', //17
      'custrecord_lmry_ntax_base_amount','custrecord_lmry_ntax_not_taxable_minimum','custrecord_lmry_ntax_new_logic','custrecord_lmry_ntax_taxcode_group',
      'custrecord_lmry_ntax_add_accumulated','custrecord_lmry_ntax_taxtype','custrecord_lmry_ntax_regimen','custrecord_lmry_ntax_iibb_norma','custrecord_lmry_ntax_taxcode',
      'custrecord_lmry_ntax_minimum_retention','custrecord_lmry_ntax_income_type','internalid'];

      var filtrosNT = new Array();
      filtrosNT[0] = search.createFilter({name:'custrecord_lmry_ntax_isexempt',operator:'is',values:['F']});
      filtrosNT[1] = search.createFilter({name:'custrecord_lmry_ntax_taxtype',operator:'is',values:[1]});
      filtrosNT[2] = search.createFilter({name:'custrecord_lmry_ntax_datefrom',operator:'onorbefore',values: fecha});
      filtrosNT[3] = search.createFilter({name:'custrecord_lmry_ntax_dateto',operator:'onorafter',values: fecha});
      filtrosNT[4] = search.createFilter({name:'isinactive',operator:'is',values:['F']});
      filtrosNT[5] = search.createFilter({name:'formulatext',formula:'{custrecord_lmry_ntax_appliesto}',operator:'ISNOTEMPTY',values:['']});
      filtrosNT[6] = search.createFilter({name:'custrecord_lmry_ntax_transactiontypes',operator:'anyof',values:['1']});
      filtrosNT[7] = search.createFilter({name:'custrecord_lmry_ntax_gen_transaction',operator:'anyof',values:['6']});
      //filtrosNT[6] = search.createFilter({name:'custrecord_lmry_ntax_transactiontypes',operator:'anyof',values:['4']});
      //filtrosNT[7] = search.createFilter({name:'custrecord_lmry_ntax_gen_transaction',operator:'anyof',values:['3']});
      filtrosNT[8] = search.createFilter({name:'custrecord_lmry_ntax_subsidiary',operator:'is',values: subsidiary});

      var searchNT = search.create({type:'customrecord_lmry_national_taxes', columns: columnasNT, filters: filtrosNT});
      resultNT = searchNT.run().getRange({start:0,end:1000});

      var columnasCC = ['custrecord_lmry_ar_ccl_taxitem','custrecord_lmry_ar_ccl_taxrate','internalid','custrecord_lmry_ccl_addratio','custrecord_lmry_ar_ccl_jurisdib', //4
      'custrecord_lmry_ccl_appliesto','custrecord_lmry_amount','custrecord_lmry_sub_type','custrecord_lmry_ccl_minamount','custrecord_lmry_ccl_montaccum',//9
      'custrecord_lmry_ar_ccl_taxrate_pctge','custrecord_lmry_ccl_fiscal_doctype','custrecord_lmry_ccl_accandmin_with','custrecord_lmry_ccl_maxamount',//13
      'custrecord_lmry_ccl_set_baseretention','custrecord_lmry_ccl_applies_to_item','custrecord_lmry_ccl_applies_to_account','custrecord_lmry_ar_ccl_subtype',//17
      'custrecord_lmry_ccl_base_amount','custrecord_lmry_ccl_not_taxable_minimum','custrecord_lmry_ccl_new_logic','custrecord_lmry_ccl_taxcode_group',
      'custrecord_lmry_ccl_add_accumulated','custrecord_lmry_ccl_taxtype','custrecord_lmry_ar_regimen','custrecord_lmry_ar_normas_iibb','custrecord_lmry_ar_ccl_taxcode',//26
      'custrecord_lmry_ccl_minimum_retention','custrecord_lmry_ccl_income_type','custrecord_lmry_ar_ccl_entity'];

      var filtrosCC = new Array();
      filtrosCC[0] = search.createFilter({name: 'custrecord_lmry_ar_ccl_entity',operator: 'anyof',values: customers});
      filtrosCC[1] = search.createFilter({name: 'custrecord_lmry_ar_ccl_isexempt',operator: 'is',values: ['F']});
      filtrosCC[2] = search.createFilter({name: 'custrecord_lmry_ccl_taxtype',operator:'is',values:[1]});
      filtrosCC[3] = search.createFilter({name: 'custrecord_lmry_ar_ccl_fechdesd',operator: 'onorbefore',values: fecha});
      filtrosCC[4] = search.createFilter({name: 'custrecord_lmry_ar_ccl_fechhast',operator: 'onorafter',values: fecha});
      filtrosCC[5] = search.createFilter({name: 'isinactive',operator: 'is',values: ['F']});
      filtrosCC[6] = search.createFilter({name: 'formulatext',operator: 'ISNOTEMPTY',formula: '{custrecord_lmry_ccl_appliesto}',values: ['']});
      filtrosCC[7] = search.createFilter({name: 'custrecord_lmry_ccl_transactiontypes',operator:'anyof',values:['1']});
      filtrosCC[8] = search.createFilter({name: 'custrecord_lmry_ccl_gen_transaction',operator:'anyof',values:['6']});
      //filtrosCC[7] = search.createFilter({name: 'custrecord_lmry_ccl_transactiontypes',operator:'anyof',values:['4']});
      //filtrosCC[8] = search.createFilter({name: 'custrecord_lmry_ccl_gen_transaction',operator:'anyof',values:['3']});
      filtrosCC[9] = search.createFilter({name: 'custrecord_lmry_ar_ccl_subsidiary',operator:'is',values: subsidiary});

      var searchCC = search.create({type: 'customrecord_lmry_ar_contrib_class',columns: columnasCC, filters: filtrosCC});
      resultCC = searchCC.run().getRange({start: 0,end: 1000});

    }

    function retencion(customer){
      for(var j in jsonInvoices){
        iterarBusquedas(customer, resultNT, '0', j);
        iterarBusquedas(customer, resultCC, '1', j);

        primerInvoice = j;
        orden = 1;
      }

      log.debug('arrayFinal',arrayFinal);

    }

    function iterarBusquedas(customer, result, bySubsidiary, invoiceActual, customerText){

      if(result != null && result.length > 0){
        var columnsResult = result[0].columns;
        for(var i = 0; i < result.length; i++){
          var customerCC = result[i].getValue(columnsResult[29]);

          if(bySubsidiary == '1' && customer != customerCC){
            continue;
          }

          var taxitem = result[i].getValue(columnsResult[0]);
          var tax_rate = result[i].getValue(columnsResult[1]);
          var internalid = result[i].getValue(columnsResult[2]);
          var ratio = result[i].getValue(columnsResult[3]);
          var jurisdiccionIIBText = result[i].getText(columnsResult[4]);
          var jurisdiccionIIB = result[i].getValue(columnsResult[4]);
          var appliesTo = result[i].getValue(columnsResult[5]);
          var appliesToText = result[i].getText(columnsResult[5]);
          var subtype = result[i].getValue(columnsResult[7]);
          var subtypeText = result[i].getText(columnsResult[7]);
          var ccl_mini = result[i].getValue(columnsResult[8]);
          var if_monthly = result[i].getValue(columnsResult[9]);
          var tax_rate_percentage = result[i].getValue(columnsResult[10]);
          var docType = result[i].getValue(columnsResult[11]);
          var maximo = result[i].getValue(columnsResult[13]);
          var setbaseretention = result[i].getValue(columnsResult[14]);
          var type = result[i].getValue(columnsResult[17]);
          var typeText = result[i].getText(columnsResult[17]);
          var doBaseAmount = result[i].getValue(columnsResult[18]);
          var doBaseAmountText = result[i].getText(columnsResult[18]);
          var minimonoimponible = result[i].getValue(columnsResult[19]);
          var newLogic = result[i].getValue(columnsResult[20]);
          var taxcodeGroup = result[i].getValue(columnsResult[21]);
          var taxcodeGroupText = result[i].getText(columnsResult[21]);
          var addAccumulated = result[i].getValue(columnsResult[22]);
          var addAccumulatedText = result[i].getText(columnsResult[22]);
          var taxtype = result[i].getValue(columnsResult[23]);
          var regimen = result[i].getValue(columnsResult[24]);
          var norma = result[i].getValue(columnsResult[25]);
          var taxcode = result[i].getValue(columnsResult[26]);
          var minimum_retention = result[i].getValue(columnsResult[27]);
          var renta = result[i].getValue(columnsResult[28]);
          var rentaText = result[i].getText(columnsResult[28]);

          var jsonAuxiliar = {};

          //VALIDACIONES
          if(!taxcodeGroup){
            continue;
          }

          if(docType){
            if(docType != jsonInvoices[invoiceActual]['doc']){
              continue;
            }
          }

          if(renta){
            if(renta != jsonAllInvoice[invoiceActual]['renta']){
              continue;
            }
          }

          if(setbaseretention == null || setbaseretention == '' || setbaseretention <= 0){
            setbaseretention = 0;
          }

          if(minimonoimponible == null || minimonoimponible == '' || minimonoimponible <= 0){
            minimonoimponible = 0;
          }

          if(maximo == null || maximo == '' || maximo <= 0){
            maximo = 0;
          }

          if(minimum_retention == null || minimum_retention == '' || minimum_retention <= 0){
            minimum_retention = 0;
          }

          if(ccl_mini == null || ccl_mini == '' || ccl_mini <= 0) {
            ccl_mini = 0;
          }

          if(ratio == null || ratio == '' || ratio <= 0) {
            ratio = 1;
          }

          //DEFINICION DE LA BASES: ACUMULADO ANTERIOR, INVOICE ACTUAL Y PAYMENT ACTUAL X CUSTOMER
          var acumAnterior = jsonAcumulado[customer]['gravado'];
          var baseActual = jsonAllInvoice[invoiceActual]['gravado'];

          var acumPayment = jsonPaymentActual['gravado'];

          //AUX EN MONEDA PAGO: SOLO PARA EL SUITELET
          var baseTotalInvoice = jsonAllInvoice[invoiceActual]['gravado']/parseFloat(jsonInvoices[invoiceActual]['porcetpago']);

          switch(taxcodeGroup){
            case '2': acumAnterior = jsonAcumulado[customer]['nogravado'];
                      baseActual = jsonAllInvoice[invoiceActual]['nogravado'];
                      acumPayment = jsonPaymentActual['nogravado'];
                      baseTotalInvoice = jsonAllInvoice[invoiceActual]['nogravado']/parseFloat(jsonInvoices[invoiceActual]['porcetpago']);break;
            case '3': acumAnterior = jsonAcumulado[customer]['exento'];
                      baseActual = jsonAllInvoice[invoiceActual]['exento'];
                      acumPayment = jsonPaymentActual['exento'];
                      baseTotalInvoice = jsonAllInvoice[invoiceActual]['exento']/parseFloat(jsonInvoices[invoiceActual]['porcetpago']);break;
            case '4': acumAnterior = jsonAcumulado[customer]['iva'];
                      baseActual = jsonAllInvoice[invoiceActual]['iva'];
                      acumPayment = jsonPaymentActual['iva'];
                      baseTotalInvoice = jsonAllInvoice[invoiceActual]['iva']/parseFloat(jsonInvoices[invoiceActual]['porcetpago']);break;
            case '5': acumAnterior = jsonAcumulado[customer]['graynogra'];
                      baseActual = jsonAllInvoice[invoiceActual]['graynogra'];
                      acumPayment = jsonPaymentActual['graynogra'];
                      baseTotalInvoice = jsonAllInvoice[invoiceActual]['graynogra']/parseFloat(jsonInvoices[invoiceActual]['porcetpago']);break;
            case '6': acumAnterior = jsonAcumulado[customer]['total'];
                      baseActual = jsonAllInvoice[invoiceActual]['total'];
                      acumPayment = jsonPaymentActual['total'];
                      baseTotalInvoice = jsonAllInvoice[invoiceActual]['total']/parseFloat(jsonInvoices[invoiceActual]['porcetpago']);break;
          }

          if(baseActual <= 0){
            continue;
          }

          //acumAnterior = Math.round(parseFloat(acumAnterior) * 1000000)/1000000;

          baseActual *= parseFloat(exchangeAR);
          acumPayment *= parseFloat(exchangeAR);

          var acumPaymentImponible = parseFloat(acumPayment) - parseFloat(minimonoimponible);

          //DISTRIBUCION DE CASOS
          var casoActual = '', baseRetencion = 0, baseComparacion = 0;
          if(newLogic){
            //CASOS LAST RETENTION
            if(if_monthly){
              baseRetencion = parseFloat(acumPaymentImponible) + parseFloat(acumAnterior);
              baseComparacion = parseFloat(acumPaymentImponible) + parseFloat(acumAnterior);

              if(parseFloat(acumAnterior) > parseFloat(ccl_mini)){
                casoActual = '8';
              }else{
                if(parseFloat(acumPaymentImponible) + parseFloat(acumAnterior) > parseFloat(ccl_mini)){
                  casoActual = '9';
                }else{
                  continue;
                }
              }
            }else{
              if(parseFloat(acumPaymentImponible) > parseFloat(ccl_mini)){
                baseRetencion = parseFloat(acumPaymentImponible);
                baseComparacion = parseFloat(acumPaymentImponible);
                casoActual = '10';
              }else{
                continue;
              }
            }

          }else{
            //CASOS SIN CHECK LAST RETENTION
            if(if_monthly){
              baseComparacion = parseFloat(acumAnterior) + parseFloat(acumPaymentImponible);
              baseRetencion = acumPaymentImponible;
              if(parseFloat(ccl_mini) > 0){
                if(parseFloat(acumAnterior) > parseFloat(ccl_mini)){
                  casoActual = '1';
                }else{
                  if(parseFloat(acumAnterior) + parseFloat(acumPaymentImponible) > parseFloat(ccl_mini)){
                    casoActual = '2';
                  }else{
                    continue; //3
                  }
                }
              }else{
                casoActual = '1'; //4
              }
            }else{
              //SIN ACUMULADO
              baseComparacion = acumPaymentImponible;
              baseRetencion = acumPaymentImponible;
              if(parseFloat(ccl_mini) > 0){
                if(parseFloat(acumPaymentImponible) > ccl_mini){
                  casoActual = '5';
                }else{
                  continue; //6
                }
              }else{
                casoActual = '7';
              }
            }
          }


          //RETENCION
          var val = 0, flagMaximo = false;
          //HAY MAXIMO
          if(parseFloat(maximo) > parseFloat(ccl_mini)){
            if(parseFloat(baseComparacion) > parseFloat(maximo)){
              continue;
            }else{

              var flagMaximo = true;
              jsonBanderas['minimo'] = true;

              //ACCUMULATED: SOLO CASOS SIN LAST RETENTION
              if(casoActual == '1' && addAccumulated == '3'){
                baseRetencion += parseFloat(acumAnterior);
              }

              if(casoActual == '2' && (addAccumulated == '2' || addAccumulated == '3')){
                baseRetencion += parseFloat(acumAnterior);
              }

              //DOBASEAMOUNT
              if((casoActual == '2' || casoActual == '9') && doBaseAmount == '5'){
                baseRetencion -= parseFloat(ccl_mini);
              }

              if(doBaseAmount == '2'){
                baseRetencion -= parseFloat(ccl_mini);
              }

              if(doBaseAmount == '3'){
                baseRetencion = parseFloat(ccl_mini);
              }

              if(doBaseAmount == '4'){
                baseRetencion = parseFloat(maximo);
              }

            }
          }

          if(parseFloat(maximo) > 0 && parseFloat(maximo) < parseFloat(ccl_mini)){
            continue;
          }

          //NO HAY MAXIMO
          if(maximo == 0){
            //ACCUMULATED: SOLO CASOS SIN LAST RETENTION
            if(casoActual == '1' && addAccumulated == '3'){
              baseRetencion += parseFloat(acumAnterior);
            }

            if(casoActual == '2' && (addAccumulated == '2' || addAccumulated == '3')){
              baseRetencion += parseFloat(acumAnterior);
            }

            if((casoActual == '2' || casoActual == '9') && doBaseAmount == '5'){
              baseRetencion -= parseFloat(ccl_mini);
            }

            if(doBaseAmount == '2'){
              baseRetencion -= parseFloat(ccl_mini);
            }

            if(doBaseAmount == '3'){
              baseRetencion = parseFloat(ccl_mini);
            }

            if(doBaseAmount == '4'){
              baseRetencion = parseFloat(maximo);
            }

          }

          if(parseFloat(baseRetencion) <= 0){
            continue;
          }

          val = parseFloat(setbaseretention) + parseFloat(baseRetencion) * parseFloat(tax_rate) * parseFloat(ratio);

          jsonAuxiliar['lastretention'] = 0;

          if(bySubsidiary == '0'){
            if(jsonLastRetentionNT[customer][internalid] != null && jsonLastRetentionNT[customer][internalid] != undefined){
              jsonAuxiliar['lastretention'] = jsonLastRetentionNT[customer][internalid];
              if(casoActual == '8' || casoActual == '9' || casoActual == '10'){
                val -= parseFloat(jsonLastRetentionNT[customer][internalid]);
              }
            }
          }else{
            if(jsonLastRetentionCC[customer][internalid] != null && jsonLastRetentionCC[customer][internalid] != undefined){
              jsonAuxiliar['lastretention'] = jsonLastRetentionCC[customer][internalid];
              if(casoActual == '8' || casoActual == '9' || casoActual == '10'){
                val -= parseFloat(jsonLastRetentionCC[customer][internalid]);
              }
            }
          }

          val = Math.round(parseFloat(val) * 1000000)/1000000;

          if(val <= 0){
            continue;
          }

          if(parseFloat(minimum_retention) >= parseFloat(val)){
            continue;
          }

          jsonAuxiliar['orden'] = orden;

          val = (parseFloat(val)*parseFloat(baseActual))/parseFloat(acumPayment);
          val = parseFloat(val) / parseFloat(exchangeAR);

          acumPayment = parseFloat(acumPayment) / parseFloat(exchangeAR);
          baseActual = parseFloat(baseActual) / parseFloat(exchangeAR);
          acumAnterior = parseFloat(acumAnterior) / parseFloat(exchangeAR);

          //EDITED AMOUNT
          if(jsonLog['edited'] != null && jsonLog['edited'] != undefined){
            var editedAmount = JSON.parse(jsonLog['edited']);
            if(editedAmount.length > 0){
              for(var k in editedAmount){
                if(editedAmount[k]['invoice'] == invoiceActual && orden == editedAmount[k]['orden']){
                  val = parseFloat(editedAmount[k]['amount']);
                }
              }
            }
          }

          //NO RETENTION
          var flagContinue = false;
          if(jsonLog['noretention'] != null && jsonLog['noretention'] != undefined){
            var noRetention = JSON.parse(jsonLog['noretention']);
            if(noRetention.length > 0){
              for(var k = 0; k < noRetention.length; k++){
                if(noRetention[k]['invoice'] == invoiceActual && noRetention[k]['orden'] == orden){
                  flagContinue = true;
                }
              }
            }
          }

          orden++;

          if(flagContinue){
            continue;
          }

          //DIVIDIR LA RETENCION PROPORCIONAL AL INVOICE
          //ESTOS CAMPOS MEJORAR Y/O USAR CON EL EDITED
          /*jsonAuxiliar['retencionPaymentAR'] = Math.round(parseFloat(val) * 1000000)/1000000;
          jsonAuxiliar['retencionPayment'] = parseFloat(val) / parseFloat(exchangeAR);*/

          /*jsonAuxiliar['retencionAR'] = Math.round(parseFloat(val) * 1000000)/1000000;;
          jsonAuxiliar['remainingAR'] = baseActual;
          jsonAuxiliar['acumuladoAR'] = acumAnterior;*/

          jsonAuxiliar['retencion'] = Math.round(parseFloat(val) * 1000000)/1000000;
          jsonAuxiliar['retencion2'] = Math.round(parseFloat(val) * 100)/100;
          var auxVal = propioRedondeo(val);
          jsonAuxiliar['retencion4'] = Math.round(parseFloat(auxVal) * 10000)/10000;
          jsonAuxiliar['payment'] = acumPayment;
          jsonAuxiliar['payment2'] = Math.round(parseFloat(acumPayment) * 100)/100;
          jsonAuxiliar['payment4'] = Math.round(parseFloat(acumPayment) * 10000)/10000;
          jsonAuxiliar['remaining'] = baseActual;
          jsonAuxiliar['remaining4'] = Math.round(parseFloat(baseActual) * 10000)/10000;
          jsonAuxiliar['baseamount'] = baseTotalInvoice;
          jsonAuxiliar['baseamount4'] = Math.round(parseFloat(baseTotalInvoice) * 10000)/10000;
          jsonAuxiliar['acumulado'] = acumAnterior;
          jsonAuxiliar['acumulado4'] = Math.round(parseFloat(acumAnterior) * 10000)/10000;;

          jsonAuxiliar['paymentHidden'] = jsonInvoices[invoiceActual]['payment'];
          jsonAuxiliar['truerate'] = tax_rate;
          jsonAuxiliar['rate'] = tax_rate_percentage;
          jsonAuxiliar['ratio'] = ratio;
          jsonAuxiliar['minimonoimponible'] = Math.round((parseFloat(minimonoimponible)/parseFloat(exchangeAR)) * 10000)/10000;
          jsonAuxiliar['minimaretencion'] = Math.round((parseFloat(minimum_retention)/parseFloat(exchangeAR)) * 10000)/10000;
          jsonAuxiliar['maximo'] = Math.round((parseFloat(maximo)/parseFloat(exchangeAR)) * 10000)/10000;;
          jsonAuxiliar['minimo'] = Math.round((parseFloat(ccl_mini)/parseFloat(exchangeAR)) * 10000)/10000;;
          jsonAuxiliar['setbaseretention'] = Math.round((parseFloat(setbaseretention)/parseFloat(exchangeAR)) * 10000)/10000;;
          jsonAuxiliar['dobaseamount'] = doBaseAmountText;
          jsonAuxiliar['addAccumulated'] = addAccumulatedText;

          if_monthly ? jsonAuxiliar['accumulated'] = 'Yes' : jsonAuxiliar['accumulated'] = 'No';

          //OTROS DATOS
          jsonAuxiliar['customerText'] = jsonLog['customerText'];
          jsonAuxiliar['invoiceActual'] = invoiceActual;
          jsonAuxiliar['internalid'] = internalid;
          jsonAuxiliar['jurisdiccionIIB'] = jurisdiccionIIB;
          jsonAuxiliar['jurisdiccionIIBText'] = jurisdiccionIIBText;
          jsonAuxiliar['taxcodeGroupText'] = taxcodeGroupText;
          jsonAuxiliar['tranid'] = jsonAllInvoice[invoiceActual]['tranid'];
          jsonAuxiliar['appliesTo'] = appliesTo;
          jsonAuxiliar['appliesToText'] = appliesToText;
          jsonAuxiliar['rentaText'] = rentaText;
          jsonAuxiliar['type'] = type;
          jsonAuxiliar['typeText'] = typeText;
          jsonAuxiliar['subtype'] = subtype;
          jsonAuxiliar['subtypeText'] = subtypeText;
          jsonAuxiliar['taxtype'] = taxtype;
          jsonAuxiliar['taxitem'] = taxitem;
          jsonAuxiliar['regimen'] = regimen;
          jsonAuxiliar['norma'] = norma;
          jsonAuxiliar['taxcode'] = taxcode;

          bySubsidiary == '0' ? jsonAuxiliar['bySubsidiary'] = 'True' : jsonAuxiliar['bySubsidiary'] = 'False';
          bySubsidiary == '0' ? jsonAuxiliar['ntCc'] = 'NT' + internalid : jsonAuxiliar['ntCc'] = 'CC' + internalid;

          arrayFinal.push(jsonAuxiliar);


          //BANDERAS
          if(addAccumulated){
            jsonBanderas['addaccumulated'] = true;
          }

          if(setbaseretention > 0){
            jsonBanderas['setbase'] = true;
          }

          if(minimonoimponible > 0){
            jsonBanderas['noimponible'] = true;
          }

          if(doBaseAmount){
            jsonBanderas['dobase'] = true;
          }

          if(minimum_retention > 0){
            jsonBanderas['minimumretention'] = true;
          }

          if(if_monthly){
            jsonBanderas['acumulado'] = true;
          }

          if(flagMaximo){
            jsonBanderas['maximo'] = true;
          }

          if(casoActual == '1' || casoActual == '2' || casoActual == '5' || casoActual == '8' || casoActual == '9' || casoActual == '10'){
            if(ccl_mini > 0){
              jsonBanderas['minimo'] = true;
            }
          }

          if(casoActual == '8' || casoActual == '9' || casoActual == '10'){
            jsonBanderas['lastretention'] = true;
          }

        }//FIN FOR
      }//FIN IF


    }

    function propioRedondeo(cantidad){
      var numero = cantidad;
      var cantidad = cantidad + "";

      cantidad = cantidad.split(',');

      if(cantidad.length == 1){
        cantidad = cantidad[0].split('.');
        if(cantidad.length == 2){
          if(cantidad[1].length == 5){
            if(cantidad[1][4] == '5'){
              cantidad[1] = parseFloat(cantidad[1]) + 1;
              cantidad[1] = (parseFloat(cantidad[1])/10).toFixed(0);
              numero = parseFloat(cantidad[0]) + parseFloat(cantidad[1])/10000;
            }
          }
        }
      }else if(cantidad.length == 2){
        if(cantidad[1].length == 5){
          if(cantidad[1][4] == '5'){
            cantidad[1] = parseFloat(cantidad[1]) + 1;
            cantidad[1] = (parseFloat(cantidad[1])/10).toFixed(0);
            numero = parseFloat(cantidad[0]) + parseFloat(cantidad[1])/10000;
          }
        }
      }

      return numero;

    }

    function reseteo(){
      //jsonPaymentActual
      //sumaPagos
      //jsonCM: podria ser
      //jsonInvoices
    }

    function llenadoSubTabla(subTabla, language){

      switch (language) {
        case 'es':
          // Nombres de campos
          var LblRet = 'Retención';
          var LblCust = 'Cliente';
          var LblOrd = 'Orden';
          var LblSource = 'Transacción de Origen (ID Interna)';
          var LblRef = 'Número de Referencia';
          var LblApplies = 'Se aplica a';
          var LblAmTo = 'Monto a';
          var LblBaseAm = 'Importe Base (Moneda Base)';
          var LblSub = 'Por Subsidiaria';
          var LblAmRem = 'Cantidad Restante';
          var LblPay = 'Pago';
          var LblSumPrev = 'Suma Retenciones Anteriores (Siempre Pesos)'
          var LblTaxMin = 'Mínimo no Imponibl';
          var LblRate = 'Tasa';
          var LblRatio = 'Proporción';
          var LblAm = 'Monto';
          var LblMinRet = 'Retención Mínima';
          var LblMinAm = 'Monto Mínimo';
          var LblMaxAm = 'Monto Máximo';
          var LblBaseRet = 'Retención Base';
          var LblMonAc = 'Acumulado Mensual';
          var LblAcAm = 'Monto Acumulado';
          var LblAddAc = 'Añadir el Monto Acumulado';
          var LblARJur = 'AR Jurisdicción';
          var LblPayInv ='Pago x Factura';
          break;

        case 'pt':
          // Nombres de campos
          var LblRet = 'Retenção';
          var LblCust = 'Cliente';
          var LblOrd = 'Pedido';
          var LblSource = 'Transação de Origem (ID Interno)';
          var LblRef = 'Referência Numérica';
          var LblApplies = 'Aplica-se a';
          var LblAmTo = 'Quantia para';
          var LblBaseAm = 'Montante Base (Moeda Base)';
          var LblSub = 'Por Subsidiária';
          var LblAmRem = 'Montante Restante';
          var LblPay = 'Pagamento';
          var LblSumPrev = 'Soma as Retenções Anteriores (Sempre Pesos)'
          var LblTaxMin = 'Não Tributável Mínimo';
          var LblRate = 'Taxa';
          var LblRatio = 'Razão';
          var LblAm = 'Valor';
          var LblMinRet = 'Retenção Mínima';
          var LblMinAm = 'Quantidade Máximat';
          var LblMaxAm = 'Quantia Máxima';
          var LblBaseRet = 'Retenção de Base';
          var LblMonAc = 'Acumulado Mensalmente';
          var LblAcAm = 'Quantidade Acumulada';
          var LblAddAc = 'Adicionar Quantia Acumulada';
          var LblARJur = 'Jurisdição AR';
          var LblPayInv ='Pagamento x Fatura';
          break;

        default:
          // Nombres de campos
          var LblRet = 'Retention';
          var LblCust = 'Customer';
          var LblOrd = 'Order';
          var LblSource = 'Source transaction (internal id)';
          var LblRef = ' Number reference';
          var LblApplies = 'Applies to';
          var LblAmTo = 'Amount to';
          var LblBaseAm = 'Base amount (Base currency)';
          var LblSub = 'By Subsidiary';
          var LblAmRem = 'Amount remaining';
          var LblPay = 'Payment';
          var LblSumPrev = 'Sum previous retentions (Always pesos)'
          var LblTaxMin = 'Not Taxable minimum';
          var LblRate = 'Rate';
          var LblRatio = 'Ratio';
          var LblAm = 'Amount';
          var LblMinRet = 'Minimum retention';
          var LblMinAm = 'Minimum amount';
          var LblMaxAm = 'Maximum amount';
          var LblBaseRet = 'Base retention';
          var LblMonAc = 'Monthly accumulated';
          var LblAcAm = 'Accumulated amount';
          var LblAddAc = 'Add accumulated amount';
          var LblARJur = 'AR Jurisdiction';
          var LblPayInv ='Payment x Invoice';
      }

      var check = subTabla.addField({id:'sub_check', label: LblRet,type: serverWidget.FieldType.CHECKBOX});
      check.defaultValue = "T";

      subTabla.addField({id: 'sub_customer',label: LblCust, type: serverWidget.FieldType.TEXT});
      subTabla.addField({id: 'sub_pago', label: LblPayInv,type: serverWidget.FieldType.TEXT}).updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN});

      subTabla.addField({id: 'sub_id',label: LblOrd,type: serverWidget.FieldType.TEXT});
      subTabla.addField({id: 'sub_transa',label: LblSource,type: serverWidget.FieldType.TEXT});
      subTabla.addField({id: 'sub_tranid',label: LblRef,type: serverWidget.FieldType.TEXT});
      subTabla.addField({id: 'sub_tip_ret',label: 'WHT ID',type: serverWidget.FieldType.TEXT});
      subTabla.addField({id: 'sub_by_subsidiary',label:LblSub,type: serverWidget.FieldType.TEXT});
      subTabla.addField({id: 'sub_appl_to',label: LblApplies,type: serverWidget.FieldType.TEXT});
      subTabla.addField({id: 'sub_amou_to',label: LblAmTo,type: serverWidget.FieldType.TEXT});
      subTabla.addField({id: 'sub_imp_bas',label: LblBaseAm,type: serverWidget.FieldType.TEXT});

      var licenses = libraryEmail.getLicenses(jsonLog['subsidiary']);

      if(libraryEmail.getAuthorization(550,licenses)){
          subTabla.addField({id: 'sub_imp_app',label: LblAmRem,type: serverWidget.FieldType.FLOAT}).updateDisplayType({displayType: serverWidget.FieldDisplayType.ENTRY});
      }else{
          subTabla.addField({id: 'sub_imp_app',label: LblAmRem,type: serverWidget.FieldType.TEXT});
      }

      subTabla.addField({id: 'sub_pago_total',label: LblPay, type:serverWidget.FieldType.TEXT});

      if(jsonBanderas['lastretention']){
        subTabla.addField({id: 'sub_retenc_anterior',label: LblSumPrev, type:serverWidget.FieldType.TEXT});
      }

      if(jsonBanderas['noimponible']){
        subTabla.addField({id:'sub_not_tax_min',label:LblTaxMin,type:serverWidget.FieldType.TEXT});
      }

      subTabla.addField({id: 'sub_por_ret',label: LblRate,type: serverWidget.FieldType.TEXT});
      subTabla.addField({id: 'sub_ratio',label: LblRatio,type: serverWidget.FieldType.TEXT});

      if(libraryEmail.getAuthorization(550,licenses)){
          subTabla.addField({id:'sub_imp_cal',label:LblAm,type: serverWidget.FieldType.FLOAT}).updateDisplayType({displayType: serverWidget.FieldDisplayType.ENTRY});
      }else{
          subTabla.addField({id: 'sub_imp_cal',label: LblAm,type: serverWidget.FieldType.TEXT});
      }

      if(jsonBanderas['minimumretention']){
        subTabla.addField({id: 'sub_retencion_minima', label: LblMinRet, type: serverWidget.FieldType.TEXT});
      }

      if(jsonBanderas['minimo']){
        subTabla.addField({id: 'sub_monto_minimo',label: LblMinAm,type: serverWidget.FieldType.TEXT});
      }

      if(jsonBanderas['maximo']){
        subTabla.addField({id: 'sub_monto_maximo',label: LblMaxAm,type: serverWidget.FieldType.TEXT});
      }

      if(jsonBanderas['setbase']){
        subTabla.addField({id: 'sub_base_retention',label: 'Set base retention',type: serverWidget.FieldType.TEXT});
      }

      if(jsonBanderas['dobase']){
        subTabla.addField({id: 'sub_substract',label: 'Do base amount',type:serverWidget.FieldType.TEXT});
      }

      if(jsonBanderas['acumulado']){
        subTabla.addField({id: 'sub_monthly',label: LblMonAc,type: serverWidget.FieldType.TEXT});
        subTabla.addField({id: 'sub_acumulado',label: LblAcAm,type: serverWidget.FieldType.TEXT});
      }

      if(jsonBanderas['addaccumulated']){
        subTabla.addField({id: 'sub_add_acumulado', label: LblAddAc, type: serverWidget.FieldType.TEXT});
      }

      subTabla.addField({id: 'sub_tipo',label: 'LATAM - TYPE',type: serverWidget.FieldType.TEXT});
      subTabla.addField({id: 'sub_sb_type',label: 'LATAM - SUB TYPE',type: serverWidget.FieldType.TEXT});
      subTabla.addField({id: 'sub_tipo_renta',label: 'LATAM - SUB CLASS',type: serverWidget.FieldType.TEXT});
      subTabla.addField({id: 'sub_jur_iib',label: LblARJur,type: serverWidget.FieldType.TEXT});

      for(var i= 0; i < arrayFinal.length; i++){
        subTabla.setSublistValue({id: 'sub_customer', line: i, value: arrayFinal[i]['customerText'] });
        subTabla.setSublistValue({id: 'sub_id',line: i, value: parseInt(arrayFinal[i]['orden']) + ""});

        var urlInvoice = url.resolveRecord({recordType: 'invoice', recordId: arrayFinal[i]['invoiceActual'], isEditMode:false});
        subTabla.setSublistValue({id: 'sub_transa',line: i, value:'<a href="' + urlInvoice + '" target="_blank">' + arrayFinal[i]['invoiceActual'] + '</a>'});

        if(arrayFinal[i]['tranid']){
          subTabla.setSublistValue({id:'sub_tranid',line: i,value: arrayFinal[i]['tranid']})
        }

        subTabla.setSublistValue({id:'sub_by_subsidiary',line: i, value: arrayFinal[i]['bySubsidiary']});

        if(arrayFinal[i]['bySubsidiary'] == 'True'){
          var urlNT = url.resolveRecord({recordType: 'customrecord_lmry_national_taxes', recordId: arrayFinal[i]['internalid'], isEditMode: false});
          subTabla.setSublistValue({id:'sub_tip_ret', line: i, value: '<a href="' + urlNT + '" target="_blank">' + arrayFinal[i]['internalid'] + '</a>'});
        }else{
          var urlCC = url.resolveRecord({recordType: 'customrecord_lmry_ar_contrib_class', recordId: arrayFinal[i]['internalid'], isEditMode: false});
          subTabla.setSublistValue({id:'sub_tip_ret', line: i, value: '<a href="' + urlCC + '" target="_blank">' + arrayFinal[i]['internalid'] + '</a>'});
        }

        subTabla.setSublistValue({id:'sub_appl_to',line: i,value: arrayFinal[i]['appliesToText']});
        subTabla.setSublistValue({id:'sub_amou_to',line: i,value: arrayFinal[i]['taxcodeGroupText']});

        subTabla.setSublistValue({id:'sub_pago',line: i,value: arrayFinal[i]['paymentHidden']});

        subTabla.setSublistValue({id:'sub_imp_bas',line: i,value: parseFloat(arrayFinal[i]['baseamount4']) + ""});
        subTabla.setSublistValue({id:'sub_imp_app',line: i,value: parseFloat(arrayFinal[i]['remaining4']) + ""});
        subTabla.setSublistValue({id:'sub_pago_total',line: i,value: parseFloat(arrayFinal[i]['payment4']) + ""});
        subTabla.setSublistValue({id:'sub_acumulado',line: i,value: parseFloat(arrayFinal[i]['acumulado4']) + ""});

        subTabla.setSublistValue({id:'sub_monthly',line: i,value: arrayFinal[i]['accumulated']});

        subTabla.setSublistValue({id:'sub_not_tax_min',line: i, value: parseFloat(arrayFinal[i]['minimonoimponible']) + ""});

        subTabla.setSublistValue({id:'sub_por_ret',line: i,value: arrayFinal[i]['rate']});
        subTabla.setSublistValue({id:'sub_ratio',line: i,value: parseFloat(arrayFinal[i]['ratio']) + ""});

        subTabla.setSublistValue({id:'sub_imp_cal',line: i,value: parseFloat(arrayFinal[i]['retencion4']) + ""});

        subTabla.setSublistValue({id:'sub_monto_minimo',line: i,value: parseFloat(arrayFinal[i]['minimo']) + ""});
        subTabla.setSublistValue({id:'sub_monto_maximo',line: i,value: parseFloat(arrayFinal[i]['maximo']) + ""});

        if(arrayFinal[i]['dobaseamount']){
          subTabla.setSublistValue({id:'sub_substract',line: i,value: arrayFinal[i]['dobaseamount']});
        }

        if(arrayFinal[i]['addAccumulated']){
          subTabla.setSublistValue({id:'sub_add_acumulado',line: i,value: arrayFinal[i]['addAccumulated']});
        }

        subTabla.setSublistValue({id:'sub_base_retention',line: i,value: parseFloat(arrayFinal[i]['setbaseretention']) + ""});
        subTabla.setSublistValue({id:'sub_retencion_minima',line: i,value: parseFloat(arrayFinal[i]['minimaretencion']) + ""});

        if(arrayFinal[i]['typeText']){
          subTabla.setSublistValue({id:'sub_tipo',line: i,value: arrayFinal[i]['typeText']});
        }

        if(arrayFinal[i]['subtypeText']){
          subTabla.setSublistValue({id:'sub_sb_type',line: i,value: arrayFinal[i]['subtypeText']});
        }

        if(arrayFinal[i]['rentaText']){
          subTabla.setSublistValue({id:'sub_tipo_renta',line: i,value: arrayFinal[i]['rentaText']});
        }

        if(arrayFinal[i]['jurisdiccionIIBText']){
          subTabla.setSublistValue({id:'sub_jur_iib',line: i,value: arrayFinal[i]['jurisdiccionIIBText']});
        }

        subTabla.setSublistValue({id:'sub_retenc_anterior',line: i, value: parseFloat(arrayFinal[i]['lastretention']) + ""});




      }

      /*

      */

    }

    function creadoTransacciones(idLog){

      var objPayment = record.transform({fromType: 'invoice', fromId: primerInvoice, toType: 'customerpayment', isDynamic: true});

      //DATOS DE CABECERA PAYMENT
      if(jsonSetupTax['formPayment']){
        objPayment.setValue({fieldId: 'customform',value: jsonSetupTax['formPayment']});
      }

      //objPayment.setValue({fieldId: 'customer', value: jsonLog['customer']});
      objPayment.setValue({fieldId: 'subsidiary', value: jsonLog['subsidiary']});
      objPayment.setValue({fieldId: 'trandate',value: format.parse({value: jsonLog['date'], type:format.Type.DATE})});
      objPayment.setValue({fieldId: 'postingperiod', value: jsonLog['period']});
      objPayment.setValue({fieldId: "custbody_lmry_paymentmethod", value: jsonLog['method']});
      objPayment.setValue({fieldId: "currency",value: jsonLog['currency']});
      objPayment.setValue({fieldId: 'aracct',value: jsonLog['aracct']});

      if(jsonLog['bank'] != null && jsonLog['bank'] != undefined){
        objPayment.setValue({fieldId: 'undepfunds',value: 'F'});
        objPayment.setValue({fieldId: 'account',value: jsonLog['bank']});
      }else{
        objPayment.setValue({fieldId: 'undepfunds',value: 'T'});
      }

      objPayment.setValue('memo','');

      if(jsonLog['memo']){
        objPayment.setValue({fieldId: 'memo',value: jsonLog['memo']});
      }

      if(jsonLog['department'] != null && jsonLog['department'] != undefined){
        objPayment.setValue({fieldId: 'department',value: jsonLog['department']});
      }

      if(jsonLog['class'] != null && jsonLog['class'] != undefined){
        objPayment.setValue({fieldId: 'class',value: jsonLog['class']});
      }

      if(jsonLog['location'] != null && jsonLog['location'] != undefined){
        objPayment.setValue({fieldId: 'location',value: jsonLog['location']});
      }

      objPayment.setValue({fieldId:'exchangerate', value: jsonLog['rate']});

      if(jsonLog['check']){
        objPayment.setValue({fieldId: 'tranid',value: jsonLog['check']});
      }

      //MULTIBOOKING PAYMENT
      if(jsonLog['multibooking']){
        var cMultibook = objPayment.getLineCount({sublistId:'accountingbookdetail'});
        for(var i = 0; i < cMultibook; i++){
          objPayment.selectLine({sublistId: 'accountingbookdetail',line: i});
          if(objPayment.getCurrentSublistValue({sublistId:'accountingbookdetail',fieldId:'currency'}) == jsonSetupTax['currency']){
            objPayment.setCurrentSublistValue({sublistId:'accountingbookdetail',fieldId:'exchangerate',value: exchangeAR});
            objPayment.commitLine({sublistId:'accountingbookdetail'});
          }
        }
      }

      //APPLY INVOICES AL PAYMENT
      var linePay = 0, totalPayment = 0;
      var cInvoices = objPayment.getLineCount({sublistId:'apply'});
      for(var i = 0; i < cInvoices; i++){
        objPayment.selectLine({sublistId: 'apply',line: i});
        var docid = objPayment.getCurrentSublistValue({sublistId: 'apply',fieldId: 'internalid'});

        if(jsonInvoices[docid] != null && jsonInvoices[docid] != undefined){
          var paymentInvoice = jsonInvoices[docid]['payment'];
          var retencion = 0;

          for(var j in arrayFinal){
            if(arrayFinal[j]['invoiceActual'] == docid){
              retencion += parseFloat(arrayFinal[j]['retencion2']);
            }
          }

          paymentInvoice -= parseFloat(retencion);

          objPayment.setCurrentSublistValue({sublistId: 'apply', fieldId: 'apply',value: true});
          objPayment.setCurrentSublistValue({sublistId: 'apply', fieldId: 'amount',value: paymentInvoice});

          totalPayment += parseFloat(paymentInvoice);
          linePay++;

        }

      }

      //ACUMULADO: SE GUARDA EN PESOS
      var jsonAcc = {};
      jsonAcc['gravado'] = parseFloat(jsonPaymentActual['gravado']) * parseFloat(exchangeAR);
      jsonAcc['nogravado'] = parseFloat(jsonPaymentActual['nogravado']) * parseFloat(exchangeAR);
      jsonAcc['graynogra'] = parseFloat(jsonPaymentActual['graynogra']) * parseFloat(exchangeAR);
      jsonAcc['exento'] = parseFloat(jsonPaymentActual['exento']) * parseFloat(exchangeAR);
      jsonAcc['iva'] = parseFloat(jsonPaymentActual['iva']) * parseFloat(exchangeAR);
      jsonAcc['total'] = parseFloat(jsonPaymentActual['total']) * parseFloat(exchangeAR);

      //GUARDADO DEL PAYMENT
      var recorpay = '';
      if(linePay > 0){
        recorpay = objPayment.save({ignoreMandatoryFields:true, disableTriggers: true});
        if(recorpay){
          record.submitFields({type: 'customrecord_lmry_new_latamtax_sales_log',id: idLog, values: {custrecord_lmry_new_latamtax_status: 'El pago ha sido generado, se estan generando las retenciones en caso hubiera, espere el estado FINALIZADO',
            custrecord_lmry_new_latamtax_payment: recorpay, custrecord_lmry_new_latamtax_payment_id: recorpay, custrecord_lmry_new_latamtax_accumulated: JSON.stringify(jsonAcc)},options: {enableSourcing: false,ignoreMandatoryFields: true, disableTriggers: true}});
        }
      }

      log.debug('recorpay',recorpay);

      //ITERACION RETENCIONES: DETAILS-CREDIT MEMO-VOUCHER
      for(var i = 0; i < arrayFinal.length; i++){
        var arrayRet = arrayFinal[i];

        var whtDetails = record.create({type: 'customrecord_lmry_wht_details',isDynamic: true});

        whtDetails.setValue({fieldId: 'custrecord_lmry_whtdet_sourcetra',value: arrayRet['invoiceActual']});

        if(arrayRet['bySubsidiary'] == 'True'){
          whtDetails.setValue({fieldId: 'custrecord_lmry_wht_nationaltax',value: arrayRet['internalid']});
        }else{
          whtDetails.setValue({fieldId: 'custrecord_lmry_whtdet_contribclass',value: arrayRet['internalid']});
        }

        whtDetails.setValue({fieldId: 'custrecord_lmry_whtdet_cc_rate',value: parseFloat(arrayRet['truerate'])});
        whtDetails.setValue({fieldId: 'custrecord_lmry_whtdet_cc_ratio',value: arrayRet['ratio']});
        whtDetails.setValue({fieldId: 'custrecord_lmry_whtdet_amount',value: arrayRet['retencion2']});
        whtDetails.setValue({fieldId: 'custrecord_lmry_whtdet_base_amount_decim',value: arrayRet['payment4']});
        whtDetails.setValue({fieldId: 'custrecord_lmry_whtdet_amount_decimal',value: arrayRet['retencion4']});

        if(arrayRet['jurisdiccionIIB']){
          whtDetails.setValue({fieldId: 'custrecord_lmry_whtdet_ccar_jurisd',value: arrayRet['jurisdiccionIIB']});
        }

        whtDetails.setValue({fieldId: 'custrecord_lmry_whtdet_vendor',value: jsonLog['customer']});
        whtDetails.setValue({fieldId: 'custrecord_lmry_whtdet_appliesto',value: arrayRet['appliesTo']});
        whtDetails.setValue({fieldId: 'custrecord_lmry_whtdet_cc_taxtype',value: arrayRet['taxtype']});
        whtDetails.setValue({fieldId: 'custrecord_lmry_whtdet_cc_taxitem',value: arrayRet['taxitem']});

        if(arrayRet['type']){
          whtDetails.setValue({fieldId:'custrecord_lmry_whtdet_ccar_subt', value: arrayRet['type']});
        }

        if(arrayRet['regimen']){
        whtDetails.setValue({fieldId:'custrecord_lmry_whtdet_regimen',value: arrayRet['regimen']});
        }

        whtDetails.setValue({fieldId:'custrecord_lmry_whtdet_baseamount',value: arrayRet['payment2']});
        whtDetails.setValue({fieldId:'custrecord_lmry_whtdet_ccl_nt',value: arrayRet['ntCc']});
        whtDetails.setValue({fieldId:'custrecord_lmry_whtdet_base_retention',value: arrayRet['setbaseretention']});

        if(recorpay){
          whtDetails.setValue({fieldId:'custrecord_lmry_wht_bill_payment',value: recorpay});
        }

        if(arrayRet['norma']){
          whtDetails.setValue({fieldId:'custrecord_lmry_wht_cc_norma',value: arrayRet['norma']});
        }

        if(arrayRet['subtype']){
          whtDetails.setValue({fieldId:'custrecord_lmry_wht_sub_type',value: arrayRet['subtype']});
        }

        var idDetails = whtDetails.save({disableTriggers:true});

        var auxRecord = record.transform({fromType: 'invoice',fromId: arrayRet['invoiceActual'], toType: 'creditmemo',isDynamic: true});
        var objRecord = record.create({type: 'creditmemo',isDynamic: true});

        if(jsonSetupTax['formCredit']){
          objRecord.setValue({fieldId:'customform', value: jsonSetupTax['formCredit']});
        }

        objRecord.setValue({fieldId:'entity',value: auxRecord.getValue({fieldId: 'entity'})});
        objRecord.setValue({fieldId:'subsidiary',value: jsonLog['subsidiary']});
        objRecord.setValue({fieldId:'account',value: auxRecord.getValue({fieldId: 'account'})});
        objRecord.setValue({fieldId:'currency',value: auxRecord.getValue({fieldId:'currency'})});
        objRecord.setValue({fieldId:'trandate',value: format.parse({value: jsonLog['date'], type:format.Type.DATE})});
        objRecord.setValue({fieldId:'postingperiod',value: jsonLog['period']});

        var newRate = (parseFloat(arrayRet['retencion4'])/parseFloat(arrayRet['retencion2']))*parseFloat(jsonLog['rate']);
        objRecord.setValue({fieldId:'exchangerate',value: newRate});

        var valTranID = '', memo = '';
        jsonAllInvoice[arrayRet['invoiceActual']]['tranid'] ? valTranID = jsonAllInvoice[arrayRet['invoiceActual']]['tranid'] : valTranID = 'REF-' + arrayRet['invoiceActual'];
        arrayRet['subtypeText'] ? memo = 'Created by LatamReady - New LatamTax Sales - ' + arrayRet['subtypeText'] : memo = 'Created by LatamReady - New LatamTax Sales';

        //objRecord.setValue({fieldId: 'tranid',value: valTranID});
        objRecord.setValue({fieldId: 'memo',value: memo});
        objRecord.setValue({fieldId: 'createdfrom',value: auxRecord.getValue({fieldId: 'createdfrom'})});
        objRecord.setValue({fieldId: 'custbody_lmry_subsidiary_country',value: auxRecord.getValue({fieldId: 'custbody_lmry_subsidiary_country'})});

        if(jsonLog['location']) {
          objRecord.setValue({fieldId: 'location',value: jsonLog['location']});
        }
        if(jsonLog['department']) {
          objRecord.setValue({fieldId: 'department',value: jsonLog['department']});
        }
        if(jsonLog['class']) {
          objRecord.setValue({fieldId: 'class',value: jsonLog['class']});
        }

        //CAMPOS LATAM
        if(recorpay){
          objRecord.setValue({fieldId: 'custbody_lmry_reference_transaction',value: recorpay});
          objRecord.setValue({fieldId: 'custbody_lmry_reference_transaction_id',value: recorpay});
        }

        objRecord.setValue({fieldId: 'custbody_lmry_fecha_retencion',value: format.parse({value: jsonLog['date'], type:format.Type.DATE})});
        objRecord.setValue({fieldId: 'custbody_lmry_impuesto_retenido',value: arrayRet['retencion2']});
        objRecord.setValue({fieldId: 'custbody_lmry_wht_base_amount',value: arrayRet['payment2']});
        objRecord.setValue({fieldId: 'custbody_lmry_invoice_applied',value: arrayRet['invoiceActual']});

        if(arrayRet['jurisdiccionIIB']){
          objRecord.setValue({fieldId: 'custbody_lmry_iibb_jurisd',value: arrayRet['jurisdiccionIIB']});
        }
        if(arrayRet['subtype']){
          objRecord.setValue({fieldId: 'custbody_lmry_wht_type',value: arrayRet['subtype']});
        }

        objRecord.setValue({fieldId: 'custbody_lmry_tasa_retencion',value: parseFloat(arrayRet['truerate'])});
        objRecord.setValue({fieldId: 'custbody_lmry_wht_details',value: idDetails});

        //LINEAS CREDIT MEMO
        objRecord.selectNewLine({sublistId: 'item'});

        objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'item',value: arrayRet['taxitem']});
        objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'quantity',value: "1"});
        objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'taxcode',value: arrayRet['taxcode']});

        /*if(fMultPrice == true || fMultPrice == 'T'){
          objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'price',value: "-1"});
        }*/

        objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'rate',value: parseFloat(arrayRet['retencion2'])});
        //objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_lmry_ar_item_tributo', value: true});
        //objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_lmry_ar_perception_percentage', value: arregloContenidoSplit[3]});
        //objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_lmry_ar_col_jurisd_iibb',value: arregloContenidoSplit[38]});

        if(jsonLog['location']) {
          objRecord.setCurrentSublistValue({sublistId:'item',fieldId: 'location',value: jsonLog['location']});
        }
        if(jsonLog['department']) {
            objRecord.setCurrentSublistValue({sublistId:'item',fieldId: 'department',value: jsonLog['department']});
        }
        if(jsonLog['class']) {
          objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'class',value: jsonLog['class']});
        }

        objRecord.commitLine({sublistId: 'item'});

        if(jsonLog['multibooking']){
          var cMultibook = objRecord.getLineCount({sublistId:'accountingbookdetail'});
          for(var j = 0; j < cMultibook; j++){
            objRecord.selectLine({sublistId: 'accountingbookdetail',line: j});
            if(objRecord.getCurrentSublistValue({sublistId:'accountingbookdetail',fieldId:'currency'}) == jsonSetupTax['currency']){
              var newRate = (parseFloat(arrayRet['retencion4'])/parseFloat(arrayRet['retencion2'])) * parseFloat(exchangeAR);
              objRecord.setCurrentSublistValue({sublistId:'accountingbookdetail',fieldId:'exchangerate',value: newRate});
              objRecord.commitLine({sublistId:'accountingbookdetail'});
            }
          }
        }

        //APPLY CREDIT MEMO AL INVOICE
        var cantApply = objRecord.getLineCount({sublistId: 'apply'});
        if (cantApply > 0) {
            for (var j = 0; j < cantApply; j++) {
                objRecord.selectLine({sublistId: 'apply',line: j});
                var docid = objRecord.getCurrentSublistValue({sublistId: 'apply',fieldId: 'doc'});
                if(docid == arrayRet['invoiceActual']) {
                  objRecord.setCurrentSublistValue({sublistId: 'apply',fieldId: 'apply',value: true});
                  objRecord.setCurrentSublistValue({sublistId: 'apply',fieldId: 'amount',value: arrayRet['retencion2']});
                }
            }
            objRecord.commitLine({sublistId: 'apply'});
        }

        var idCreditMemo = objRecord.save({ignoreMandatoryFields:true,disableTriggers:true});

        if(idCreditMemo){
          var witaxbamt = arrayRet['payment'], witaxamt;

          witaxbamt = parseFloat(witaxbamt) * parseFloat(exchangeAR);
          witaxamt = parseFloat(arrayRet['retencion4']) * parseFloat(exchangeAR);

          var voucher = record.create({type: 'customrecord_lmry_ar_comproban_retencion',isDynamic: true});
          //voucher.setValue({fieldId: 'custrecord_lmry_ar_serie_retencion',value: serieCompr});
          //voucher.setValue({fieldId: 'custrecord_lmry_ar_comp_retencion',value: witaxseri});
          voucher.setValue({fieldId: 'custrecord_lmry_ar_pago_relacionado',value: idCreditMemo}); //CREDIT MEMO
          voucher.setValue({fieldId: 'custrecord_lmry_ar_pago_internalid',value: recorpay}); //PAYMENT
          voucher.setValue({fieldId: 'custrecord_lmry_ar_proveedor',value: jsonLog['customer']});
          voucher.setValue({fieldId: 'custrecord_lmry_ar_trans_paid_id',value: recorpay});
          voucher.setValue({fieldId: 'custrecord_lmry_ar_trans_paid_cur',value: jsonSetupTax['currency']});
          voucher.setValue({fieldId: 'custrecord_lmry_ar_witaxrate',value: parseFloat(arrayRet['truerate'])});

          voucher.setValue({fieldId: 'custrecord_lmry_ar_trans_paid_exc',value: 1/parseFloat(exchangeAR)});
          voucher.setValue({fieldId: 'custrecord_lmry_ar_trans_paid_amo',value: parseFloat(jsonInvoices[arrayRet['invoiceActual']]['payment']) * parseFloat(exchangeAR)});//MONTO DEL BILL PAYMENT

          totalPayment *= parseFloat(exchangeAR);
          totalPayment = Math.round(parseFloat(totalPayment)*10000)/10000;

          voucher.setValue({fieldId: 'custrecord_lmry_ar_billpayment_amo',value: totalPayment}); // MONTO QUE HE INGRESADO

          var totalTransaction = parseFloat(jsonInvoices[arrayRet['invoiceActual']]['total']) * parseFloat(exchangeAR);
          totalTransaction = Math.round(parseFloat(totalTransaction)*10000)/10000;

          voucher.setValue({fieldId: 'custrecord_lmry_ar_total_transaccion',value: totalTransaction});

          voucher.setValue({fieldId: 'custrecord_lmry_ar_witaxbamt',value: Math.round(parseFloat(witaxbamt)*100)/100});
          voucher.setValue({fieldId: 'custrecord_lmry_ar_witaxamt',value: Math.round(parseFloat(witaxamt)*100)/100});

          var idVoucher = voucher.save({disableTriggers:true});
          record.submitFields({type:'customrecord_lmry_wht_details', id: idDetails, values:{custrecord_lmry_wht_bill_credit: idCreditMemo, custrecord_lmry_wht_voucher: idVoucher},option:{disableTriggers:true}});

        }

      }//FIN ITERACION DE RETENCIONES

      /*if(recorpay){
        var editPayment = record.load({type: 'customerpayment', id:recorpay});
        editPayment.save({ignoreMandatoryFields: true, disableTriggers: true});
      }*/

    }

    function setupTaxSubsidiary(subsidiary){

      var filtrosSetupTax = [];
      filtrosSetupTax[0] = search.createFilter({name:'isinactive',operator:'is',values:['F']});
      filtrosSetupTax[1] = search.createFilter({name:'custrecord_lmry_setuptax_subsidiary', operator:'anyof',values: subsidiary});

      var searchSetupTax = search.create({type: 'customrecord_lmry_setup_tax_subsidiary', filters: filtrosSetupTax,
      columns:['custrecord_lmry_setuptax_amorounding','custrecord_lmry_setuptax_type_rounding','custrecord_lmry_setuptax_currency','custrecord_lmry_setuptax_form_custpaymt',
      'custrecord_lmry_setuptax_form_creditmemo','custrecord_lmry_setuptax_ar_group']});

      var resultSetupTax = searchSetupTax.run().getRange({start:0,end:1});

      jsonSetupTax = {
        'rounding': resultSetupTax[0].getValue('custrecord_lmry_setuptax_amorounding'),
        'typeRounding': resultSetupTax[0].getValue('custrecord_lmry_setuptax_type_rounding'),
        'currency': resultSetupTax[0].getValue('custrecord_lmry_setuptax_currency'),
        'formPayment': resultSetupTax[0].getValue('custrecord_lmry_setuptax_form_custpaymt'),
        'formCredit': resultSetupTax[0].getValue('custrecord_lmry_setuptax_form_creditmemo'),
        'groupWHT': resultSetupTax[0].getValue('custrecord_lmry_setuptax_ar_group')
      };

      log.debug('jsonSetupTax',JSON.stringify(jsonSetupTax));

    }

    function multibooking(currency, multibook, rate){

      if(multibook){
        var auxMB = JSON.parse(multibook);
        exchangeAR = auxMB[0]['rate'];

      }else{
        if(jsonSetupTax['currency'] == currency){
          exchangeAR = 1;
        }else{
          exchangeAR = rate;
        }
      }

    }


    return {
        getSalesLog: getSalesLog,
        getAccumulated: getAccumulated,
        basesAllInvoice: basesAllInvoice,
        creditMemo: creditMemo,
        ccynt: ccynt,
        retencion: retencion,
        reseteo: reseteo,
        multibooking: multibooking,
        setupTaxSubsidiary : setupTaxSubsidiary,
        llenadoSubTabla : llenadoSubTabla,
        creadoTransacciones : creadoTransacciones
    };

});
