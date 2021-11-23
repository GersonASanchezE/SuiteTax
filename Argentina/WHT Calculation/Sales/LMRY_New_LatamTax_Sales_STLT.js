/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_New_LatamTax_Sales_STLT.js  				        ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Oct 20 2020  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/log', 'N/currency', 'N/format','N/config','N/redirect','N/url','N/task','N/search','N/record','N/ui/serverWidget','N/runtime','./Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],

function(log, currency, format, config,redirect,url,task,search,record,serverWidget,runtime, library) {

    var LMRY_script = 'LatamReady - New LatamTax Sales STLT';
    var Language = runtime.getCurrentScript().getParameter({name: 'LANGUAGE'});
    Language = Language.substring(0, 2);

    switch (Language) {
      case 'es':
        // Nombres de campos
        var LblMsg1 = 'AVISO: Actualmente la licencia para este módulo está vencida, por favor contacte al equipo comercial de LatamReady';
        var LblMsg2 = 'También puedes contactar con nosotros a través de';
        var LblMsg3 = 'Importante: El acceso no está permitido';
        var LblGroup1 = 'Información Primaria';
        var LblTittleMsg = 'Mensaje';
        var LblMulti = 'Multibooking';
        var LblCust = 'Cliente';
        var LblBook = 'Libro';
        var LblSub = 'Subsidiaria';
        var LblBaseCur = 'Moneda Base';
        var LblCur = 'Moneda';
        var LblARAccount = 'Cuenta A/R';
        var LblBnkAccount = 'Cuenta Bancaria';
        var LblActPrd = 'Priodo Contable';
        var LblGroup2 = 'Classificación';
        var LblDpt = 'Departmento';
        var LblPyMtd = 'LATAM - Método de Pago';
        var LblClass = 'Clase';
        var LblLct = 'Ubicación';
        var LblIDProcess = 'ID Proceso';
        var TabTrans = 'Transacciones';
        var LblTrans ='Transacción';
        var LblApply = 'Aplicar';
        var LblInternalID = 'ID Interna';
        var LblSublist = 'Sublista'
        var LblTotalAm = 'Monto Total';
        var LblDueAm = 'Monto Adeudado';
        var LblPay = 'Pago';
        var LblUndep = 'Fondos Undep';
        var LblCred = 'Nota de Crédit';
        var LblDate = 'Fecha';
        var BtnBack = 'Atrás';
        var BtnSave = 'Guardar';
        var LblAcBooks = 'Libros Contables';
        var LblInv = 'Facturas';
        var LblExRate = 'Tipo de Cambio';
        var BtnMarkAll = 'Marcar Todo';
        var BtnDesmarkAll = 'Desmarcar Todo';
        var LblFiscal = 'Documento Fiscal';
        var BtnFilter = 'Filtrar';
        var LblForm = 'LatamReady - Nuevo LatamTax Ventas';
        break;

      case 'pt':
        // Nombres de campos
        var LblMsg1 = 'AVISO: Atualmente a licença para este módulo expirou, entre em contato com a equipe comercial da LatamReady';
        var LblMsg2 = 'Você também pode nos contatar através de';
        var LblMsg3 = 'Importante: o acesso não é permitido';
        var LblGroup1 = 'Informação Primária';
        var LblTittleMsg = 'Mensagem';
        var LblMulti = 'Multibooking';
        var LblCust = 'Cliente';
        var LblBook = 'Livro';
        var LblSub = 'Subsidiária';
        var LblBaseCur = 'Moeda Base';
        var LblCur = 'Moeda';
        var LblARAccount = 'Conta A/R';
        var LblBnkAccount = 'Conta bancária';
        var LblActPrd = 'Período contábil';
        var LblGroup2 = 'Classificação';
        var LblDpt = 'Departmento';
        var LblPyMtd = 'LATAM - Forma de Pagamento';
        var LblClass = 'Classe';
        var LblLct = 'Localização';
        var LblIDProcess = 'ID do processo';
        var TabTrans = 'Transações';
        var LblTrans ='Transação';
        var LblApply = 'Aplicar';
        var LblInternalID = 'ID Interno';
        var LblSublist = 'Sublista'
        var LblTotalAm = 'Montante Total';
        var LblDueAm = 'Quantia Devida';
        var LblPay = 'Pagamento';
        var LblUndep = 'Undep Funds';
        var LblCred = 'Nota de Crédito';
        var LblDate = 'Data';
        var BtnBack = 'Voltar';
        var BtnSave = 'Salve';
        var LblAcBooks = 'Livros de Contabilidade';
        var LblInv = 'Faturas';
        var LblExRate = 'Taxa de Câmbio';
        var BtnMarkAll = 'Marcar Tudo';
        var BtnDesmarkAll = 'Desmarcar Tudo';
        var LblFiscal = 'Documento Fiscal';
        var BtnFilter = 'Filtro';
        var LblForm = 'LatamReady - Novas Vendas LatamTax';
        break;

      default:
        // Nombres de campos
        var LblMsg1 = 'NOTICE: Currently the license for this module is expired, please contact the commercial team of LatamReady';
        var LblMsg2 = 'You can also contact us through';
        var LblMsg3 = 'Important: Access is not allowed';
        var LblGroup1 = 'Primary Information';
        var LblTittleMsg = 'Message';
        var LblMulti = 'Multibooking';
        var LblCust = 'Customer';
        var LblBook = 'Book';
        var LblSub = 'Subsidiary';
        var LblBaseCur = 'Base currency';
        var LblCur = 'Currency';
        var LblARAccount = 'A/R Account';
        var LblBnkAccount = 'Bank Account';
        var LblActPrd = 'Accounting Period';
        var LblGroup2 = 'Classification';
        var LblDpt = 'Department';
        var LblPyMtd = 'LATAM - Payment Method';
        var LblClass = 'Class';
        var LblLct = 'Location';
        var LblIDProcess = 'Process ID';
        var TabTrans = 'Transactions';
        var LblTrans ='Transaction';
        var LblApply = 'Apply';
        var LblInternalID = 'Internal ID';
        var LblSublist = 'Sublist'
        var LblTotalAm = 'Total amount';
        var LblDueAm = 'Amount due';
        var LblPay = 'Payment';
        var LblUndep = 'Undep Funds';
        var LblCred = 'Credit Memo';
        var LblDate = 'Date';
        var BtnBack = 'Back';
        var BtnSave = 'Save';
        var LblAcBooks = 'Accounting books';
        var LblInv = 'Invoices';
        var LblExRate = 'Exchange Rate';
        var BtnMarkAll = 'Mark all';
        var BtnDesmarkAll = 'Desmark all';
        var LblFiscal = 'Fiscal Document';
        var BtnFilter = 'Filter';
        var LblForm = 'LatamReady - New LatamTax Sales';
    }

    function onRequest(context) {

      try{

        var subsi_OW = runtime.isFeatureInEffect({feature: "SUBSIDIARIES"});
        var featureMB = runtime.isFeatureInEffect({feature: "MULTIBOOK"});

        if(context.request.method == 'GET'){

          var form = serverWidget.createForm({title: LblForm});

          form.clientScriptModulePath = './WTH_Library/LMRY_New_LatamTax_Sales_CLNT.js';

          var Rd_SubId = context.request.parameters.custparam_subsi;
          var Rd_AccId = context.request.parameters.custparam_aracc;
          var Rd_CustId = context.request.parameters.custparam_cust;
          var Rd_CurrId = context.request.parameters.custparam_curr;
          var Rd_UndepId = context.request.parameters.custparam_undep;
          var Rd_BankId = context.request.parameters.custparam_bank;
          var Rd_DateId = context.request.parameters.custparam_date;
          var Rd_PerId = context.request.parameters.custparam_period;
          var Rd_RateId = context.request.parameters.custparam_exchange;
          var Rd_DepId = context.request.parameters.custparam_depart;
          var Rd_ClaId = context.request.parameters.custparam_class;
          var Rd_LocId = context.request.parameters.custparam_locat;
          var Rd_MetId = context.request.parameters.custparam_method;

          var allLicenses = library.getAllLicenses();

          //PRIMARY INFORMATION
          form.addFieldGroup({id: 'group_pi',label: LblGroup1});

          var p_subsi = form.addField({id: 'custpage_id_subsi',label: LblSub,type: serverWidget.FieldType.SELECT,container: 'group_pi'});
          p_subsi.isMandatory = true;

          var filtrosSubsi = [];
          filtrosSubsi[0] = search.createFilter({name: 'isinactive',operator: search.Operator.IS,values: 'F'});
          filtrosSubsi[1] = search.createFilter({name: 'country',operator: search.Operator.ANYOF,values: 'AR'});

          var searchSub = search.create({type: search.Type.SUBSIDIARY,filters: filtrosSubsi, columns: ['internalid', 'name']});
          var resultSub = searchSub.run().getRange({start: 0,end: 1000});

          var contador = 0;

          if (resultSub != null && resultSub.length > 0) {
              p_subsi.addSelectOption({value: 0,text: ' '});
              for (var i = 0; i < resultSub.length; i++) {
                  var subID = resultSub[i].getValue('internalid');
                  var subNM = resultSub[i].getValue('name');

                  if(allLicenses[subID] != null && allLicenses[subID] != undefined){
                    for(var j = 0; j < allLicenses[subID].length; j++){
                      if(allLicenses[subID][j] == 540){
                        p_subsi.addSelectOption({value: subID,text: subNM});
                        contador++;
                      }
                    }
                  }

              }
          }

          if(contador == 0){
            // Mensaje para el cliente
            var formLicencia = serverWidget.createForm({title:'LatamReady - New LatamTax Sales'});
            var myInlineHtml = formLicencia.addField({id: 'custpage_lmry_v_message',label: LblTittleMsg,type: serverWidget.FieldType.INLINEHTML});

            myInlineHtml.layoutType = serverWidget.FieldLayoutType.OUTSIDEBELOW;
            myInlineHtml.updateBreakType({breakType: serverWidget.FieldBreakType.STARTCOL});

            var strhtml = "<html>";
            strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>" +
                "<tr>" +
                "</tr>" +
                "<tr>" +
                "<td class='text'>" +
                "<div style=\"color: gray; font-size: 12pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">" +
                LblMsg1+".</br>"+LblMsg2+"www.Latamready.com" +
                "</div>" +
                "</td>" +
                "</tr>" +
                "</table>" +
                "</html>";
            myInlineHtml.defaultValue = strhtml;

            // Dibuja el formularios
            context.response.writePage(formLicencia);

            // Termina el SuiteLet
            return true;
          }

          var p_aracc = form.addField({id:'custpage_id_aracc', type: 'select', label: LblARAccount, container: 'group_pi'});
          p_aracc.isMandatory = true;

          var p_customer = form.addField({id:'custpage_id_customer', type: 'select', label: LblCust, container: 'group_pi'});
          p_customer.isMandatory = true;

          var p_currency = form.addField({id:'custpage_id_currency', type: 'select', label: LblCur, container: 'group_pi'});
          p_currency.isMandatory = true;

          var p_undepTrue = form.addField({id:'custpage_id_undep', type: 'radio', label: LblUndep, container: 'group_pi', source: 'T'});
          p_undepTrue.updateBreakType({breakType: serverWidget.FieldBreakType.STARTCOL});

          var p_undepFalse = form.addField({id:'custpage_id_undep', type: 'radio', label: LblBnkAccount, container: 'group_pi', source: 'F'});

          var p_bank = form.addField({id:'custpage_id_bank', type: 'select', label: ' ', container: 'group_pi'});
          p_bank.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});

          var p_date = form.addField({id:'custpage_id_date', type:serverWidget.FieldType.DATE, label:LblDate, container:'group_pi', source:'date'});
          p_date.isMandatory = true;

          var p_period = form.addField({id:'custpage_id_period', type: 'select', label: LblActPrd, container: 'group_pi'});
          p_period.isMandatory = true;
          p_period.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});

          var p_exchange = form.addField({id:'custpage_id_exchange', type: 'float', label: LblExRate, container: 'group_pi'});
          p_exchange.updateBreakType({breakType: serverWidget.FieldBreakType.STARTCOL});
          p_exchange.isMandatory = true;

          var p_check = form.addField({id:'custpage_id_checknumber', type: 'text', label: 'CHECK #', container: 'group_pi'});

          var p_memo = form.addField({id:'custpage_id_memo', type: 'text', label: 'MEMO', container: 'group_pi'});

          if(Rd_SubId != null && Rd_SubId != ''){
            var p_state = form.addField({id: 'custpage_id_state',type: 'text', label: LblIDProcess, container: 'group_pi'});
            p_state.defaultValue = 'PENDIENTE';
            p_state.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
          }else{
            p_check.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
            p_memo.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
          }

          //CLASSIFICATION
          form.addFieldGroup({id: 'group_clas',label: LblGroup2});

          //VISIBLE
          var enab_dep = runtime.isFeatureInEffect({feature: "DEPARTMENTS"});
          var enab_loc = runtime.isFeatureInEffect({feature: "LOCATIONS"});
          var enab_clas = runtime.isFeatureInEffect({feature: "CLASSES"});

          //MANDATORY
          var pref_dep = runtime.getCurrentUser().getPreference({name: "DEPTMANDATORY"});
          var pref_loc = runtime.getCurrentUser().getPreference({name: "LOCMANDATORY"});
          var pref_clas = runtime.getCurrentUser().getPreference({name: "CLASSMANDATORY"});

          if(enab_dep){
            var p_department = form.addField({id:'custpage_id_depart', type: 'select', label: LblDpt, container: 'group_clas'});
            if(pref_dep){
              p_department.isMandatory = true;
            }
          }

          var p_method = form.addField({id:'custpage_id_method', type: 'select', label: LblPyMtd, container: 'group_clas'});
          p_method.isMandatory = true;

          if(enab_clas){
            var p_class = form.addField({id:'custpage_id_class', type: 'select', label: LblClass, container: 'group_clas'});
            if(pref_clas){
              p_class.isMandatory = true;
            }
          }

          if(enab_loc){
            var p_location = form.addField({id:'custpage_id_location', type: 'select', label: LblLct, container: 'group_clas'});
            if(pref_loc){
              p_location.isMandatory = true;
            }
          }

          //MULTIBOOKING
          form.addTab({id:'custpage_tab1',label:TabTrans});
          if(featureMB && Number(Rd_SubId)){
            var searchSetupTax = search.create({type: 'customrecord_lmry_setup_tax_subsidiary', filters: [{name: 'isinactive', operator: 'is', values: 'F'},{name: 'custrecord_lmry_setuptax_subsidiary', operator: 'is', values: Rd_SubId}],
            columns: ['custrecord_lmry_setuptax_currency','custrecord_lmry_setuptax_check']});

            var resultSetupTax = searchSetupTax.run().getRange({start: 0 ,end: 1});
            var currencySetup = resultSetupTax[0].getValue('custrecord_lmry_setuptax_currency');
            var checkSetup = resultSetupTax[0].getValue('custrecord_lmry_setuptax_check');

            if(checkSetup == true || checkSetup == 'T'){
              p_check.isMandatory = true;
            }

            var currencySub = search.lookupFields({type: 'subsidiary',id: Rd_SubId, columns:['currency']});
            currencySub = currencySub.currency[0].value;

            var flagMB = false;
            if(currencySetup != currencySub && currencySetup != Rd_CurrId){
              flagMB = true;
            }

            if(flagMB){
              form.addTab({id:'custpage_tab2',label:LblMulti});

              var subTablaBook = form.addSublist({id:'custpage_id_sublista_book', type: serverWidget.SublistType.LIST, label: LblAcBooks,tab:'custpage_tab2'});
              subTablaBook.addField({id: 'custpage_id_book', label: LblBook, type: 'text'});
              subTablaBook.addField({id: 'custpage_id_currency', label: LblBaseCur, type: 'text'});

              var exBook = subTablaBook.addField({id: 'custpage_id_rate_book', label: LblExRate,type: 'float'}).updateDisplayType({displayType: serverWidget.FieldDisplayType.ENTRY});
              exBook.isMandatory = true;

              var searchIsocode = search.lookupFields({type: 'currency', id: currencySub, columns: ['symbol']});
              searchIsocode = searchIsocode.symbol;

              var recordSubsi = record.load({type: 'subsidiary', id: Rd_SubId});

              var cLineas = recordSubsi.getLineCount({sublistId: 'accountingbookdetail'});
              if(cLineas > 0){
                for(var i = 0; i < cLineas; i++){
                  var nameBook = recordSubsi.getSublistText({sublistId: 'accountingbookdetail', fieldId: 'accountingbook', line: i});
                  var currencyBook = recordSubsi.getSublistText({sublistId: 'accountingbookdetail', fieldId: 'currency', line: i});
                  var statusBook = recordSubsi.getSublistText({sublistId: 'accountingbookdetail', fieldId: 'bookstatus', line: i});
                  statusBook = statusBook.substring(0,3);
                  statusBook = statusBook.toUpperCase();

                  if(statusBook != 'ACT'){
                    continue;
                  }

                  var searchIsocodeBook = search.lookupFields({type: 'currency', id: recordSubsi.getSublistValue({sublistId: 'accountingbookdetail', fieldId: 'currency', line: i}), columns: ['symbol']});
                  searchIsocodeBook = searchIsocodeBook.symbol;

                  var rate = currency.exchangeRate({source: searchIsocode, target: searchIsocodeBook, date: new Date()});

                  subTablaBook.setSublistValue({id: 'custpage_id_book', line: i, value: nameBook});
                  subTablaBook.setSublistValue({id: 'custpage_id_currency', line: i, value: currencyBook});
                  subTablaBook.setSublistValue({id: 'custpage_id_rate_book', line: i, value: rate});
                }
              }

            }

          }

          //SUBLISTA
          var subtablaPay = form.addSublist({id:'custpage_id_sublist',type: serverWidget.SublistType.LIST, label: LblInv, tab: 'custpage_tab1'});

          subtablaPay.addField({id: 'custpage_id_check', label: LblApply, type: 'checkbox'});
          subtablaPay.addField({id: 'custpage_id_int', label: LblInternalID, type: 'text'});
          subtablaPay.addField({id: 'custpage_id_tra', label: LblTrans, type: 'text'});
          subtablaPay.addField({id: 'custpage_id_date', label: LblDate, type: 'text'});
          //subtablaPay.addField({id: 'custpage_id_cust', label: 'CUSTOMER', type: 'text'});
          subtablaPay.addField({id: 'custpage_id_doc', label: LblFiscal, type: 'select', source: 'customrecord_lmry_tipo_doc'}).updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});

          //subtablaPay.addField({id: 'custpage_id_curr', label: 'CURRENCY', type: 'text'});
          subtablaPay.addField({id: 'custpage_id_exch', label: LblExRate, type: 'float'});
          subtablaPay.addField({id: 'custpage_id_cm', label: LblCred, type: 'currency'});
          subtablaPay.addField({id: 'custpage_id_bases', label: 'BASES CM', type: 'text'}).updateDisplayType({displayType:serverWidget.FieldDisplayType.HIDDEN});;

          subtablaPay.addField({id: 'custpage_id_total', label: LblTotalAm, type: 'currency'});
          subtablaPay.addField({id: 'custpage_id_due', label: LblDueAm, type: 'currency'});
          var payInvoice = subtablaPay.addField({id: 'custpage_id_pay', label: LblPay, type: 'currency'});
          payInvoice.updateDisplayType({displayType: serverWidget.FieldDisplayType.ENTRY});
          payInvoice.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});

          if(Rd_SubId != null && Rd_SubId != ''){

            subtablaPay.addButton({id:'id_mark', label:BtnMarkAll, functionName:'markAll'});
            subtablaPay.addButton({id:'id_desmark', label:BtnDesmarkAll, functionName:'desmarkAll'});

            //SETEO DE VALORES X DEFECTO
            p_subsi.defaultValue = Rd_SubId;

            //AR ACCOUNT
            var searchArAccount = search.load({id: 'customsearch_lmry_wht_account_receivable'});
            searchArAccount.filters.push(search.createFilter({ name: 'subsidiary', operator: 'anyof', values: Rd_SubId}));

            var resultArAccount = searchArAccount.run().getRange({start:0, end:1000});
            var columnasAr = resultArAccount[0].columns;

            for(var i = 0; i < resultArAccount.length; i++){
              var idAccount = resultArAccount[i].getValue(columnasAr[0]);
              var nameAccount = resultArAccount[i].getValue(columnasAr[1]);

              if(idAccount == Rd_AccId){
                p_aracc.addSelectOption({value: Rd_AccId,text: nameAccount});
                break;
              }

            }

            //CUSTOMER
            var searchCustomer = search.lookupFields({type: 'customer', id: Rd_CustId, columns: ['entityid', 'companyname', 'firstname', 'lastname', 'isperson','middlename']});
            var texto = searchCustomer['entityid'] ? searchCustomer['entityid'] + " " : "";

            if(searchCustomer['isperson']){
              texto += searchCustomer['firstname'] + " ";
              texto += searchCustomer['middlename'] ? searchCustomer['middlename'].substring(0,1) + " ": "";
              texto += searchCustomer['lastname'];
            }else{
              texto += searchCustomer['companyname'];
            }

            p_customer.addSelectOption({value: Rd_CustId, text: texto});

            var searchCurrency = search.lookupFields({type: 'currency', id: Rd_CurrId, columns: ['name']});
            p_currency.addSelectOption({value: Rd_CurrId, text: searchCurrency['name']});

            p_undepTrue.defaultValue = Rd_UndepId;

            if(Rd_UndepId == false || Rd_UndepId == 'F'){
              var searchBankAccount = search.load({ id: 'customsearch_lmry_wht_bank_account' });
              searchBankAccount.filters.push(search.createFilter({ name: 'subsidiary', operator: 'anyof', values: Rd_SubId }));

              var resultBankAccount = searchBankAccount.run().getRange({start: 0, end: 1000});
              var columnsBankAccount = resultBankAccount[0].columns;

              for(var i = 0; i < resultBankAccount.length; i++){
                var idAccount = resultBankAccount[i].getValue(columnsBankAccount[0]);
                var nameAccount = resultBankAccount[i].getValue(columnsBankAccount[1]);

                if(idAccount == Rd_BankId){
                  p_bank.addSelectOption({value: Rd_BankId, text: nameAccount});
                  break;
                }

              }

            }

            p_date.defaultValue = Rd_DateId;

            var searchPeriod = search.lookupFields({type: 'accountingperiod', id: Rd_PerId, columns: ['periodname']});
            p_period.addSelectOption({value: Rd_PerId, text: searchPeriod['periodname']});

            p_exchange.defaultValue = Rd_RateId;

            //SEGMENTACION Y PAYMENT METHOD
            if(enab_dep){
              if(Number(Rd_DepId)){
                var searchDepartment = search.lookupFields({type: 'department', id: Rd_DepId, columns: ['name']});
                p_department.addSelectOption({value: Rd_DepId, text: searchDepartment['name']});
              }
              p_department.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
            }

            if(enab_clas){
              if(Number(Rd_ClaId)){
                var searchClass = search.lookupFields({type: 'classification', id: Rd_ClaId, columns: ['name']});
                p_class.addSelectOption({value: Rd_ClaId, text: searchClass['name']});
              }
              p_class.updateDisplayType({displayType:'disabled'});
            }

            if(enab_loc){
              if(Number(Rd_LocId)){
                var searchLocation = search.lookupFields({type: 'location', id: Rd_LocId, columns: ['name']});
                p_location.addSelectOption({value: Rd_LocId, text: searchLocation['name']});
              }
              p_location.updateDisplayType({displayType:'disabled'});
            }

            var searchPayMethod = search.lookupFields({type: 'customrecord_lmry_paymentmethod', id: Rd_MetId, columns: ['name']});
            p_method.addSelectOption({value: Rd_MetId, text: searchPayMethod['name']});

            //DISABLED
            p_subsi.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
            p_aracc.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
            p_customer.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
            p_currency.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
            p_undepTrue.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
            p_undepFalse.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
            p_bank.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
            p_date.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
            //p_period.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
            p_exchange.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
            p_method.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});

            //CREDIT MEMOS ANTES DEL PAGO
            var searchCM = search.create({type: 'creditmemo', filters:[
              ['subsidiary','anyof',Rd_SubId],"AND",['currency','anyof',Rd_CurrId],"AND",['entity','anyof',Rd_CustId],"AND",['account','anyof',Rd_AccId],"AND",
              ['mainline','is',true],"AND",['custbody_lmry_wht_details','anyof','@NONE@']],
              columns:[{name: 'internalid',sort: search.Sort.DESC},{name:'custrecord_lmry_transaction_f_exento',join:'CUSTRECORD_LMRY_TRANSACTION_F'},
              {name:'custrecord_lmry_transaction_f_iva',join:'CUSTRECORD_LMRY_TRANSACTION_F'},{name:'custrecord_lmry_transaction_f_gravado',join:'CUSTRECORD_LMRY_TRANSACTION_F'},
              {name:'custrecord_lmry_transaction_f_no_gravado',join:'CUSTRECORD_LMRY_TRANSACTION_F'},{name:'internalid',join:'appliedToTransaction'},'fxamount',{name:'internalid',join:'CUSTRECORD_LMRY_TRANSACTION_F'}]
            });

            var contadorCM = 0, banderaCM = true;
            var jsonCM = {};
            var resultCM = searchCM.run();

            while(banderaCM){
              var resultCMRange = resultCM.getRange({start: contadorCM, end: contadorCM + 1000});

              if(resultCMRange.length == 0){
                break;
              }

              var columnsCM = resultCMRange[0].columns;
              for(var i = 0; i < resultCMRange.length; i++){
                var idInvoice = resultCMRange[i].getValue(columnsCM[5]);
                var idCM = resultCMRange[i].getValue(columnsCM[7]);

                if(idCM){
                  if(jsonCM[idInvoice] == null || jsonCM[idInvoice] == undefined){
                    jsonCM[idInvoice] = {'amount': 0, 'gravado': 0, 'nogravado': 0, 'exento': 0, 'iva': 0};
                  }

                  jsonCM[idInvoice]['amount'] = parseFloat(jsonCM[idInvoice]['amount']) + Math.abs(parseFloat(resultCMRange[i].getValue(columnsCM[6])));
                  jsonCM[idInvoice]['gravado'] = parseFloat(jsonCM[idInvoice]['gravado']) + Math.abs(parseFloat(resultCMRange[i].getValue(columnsCM[3])));
                  jsonCM[idInvoice]['nogravado'] = parseFloat(jsonCM[idInvoice]['nogravado']) + Math.abs(parseFloat(resultCMRange[i].getValue(columnsCM[4])));
                  jsonCM[idInvoice]['exento'] = parseFloat(jsonCM[idInvoice]['exento']) + Math.abs(parseFloat(resultCMRange[i].getValue(columnsCM[1])));
                  jsonCM[idInvoice]['iva'] = parseFloat(jsonCM[idInvoice]['iva']) + Math.abs(parseFloat(resultCMRange[i].getValue(columnsCM[2])));
                }
              }

              if(resultCMRange.length == 1000){
                contadorCM += 1000;
              }else{
                banderaCM = false;
              }
            }

            log.debug('jsonCM',JSON.stringify(jsonCM));

            //BUSQUEDA DE INVOICES
            var filtrosInvoice = [];
            filtrosInvoice[0] = search.createFilter({name:'subsidiary', operator:'is',values: Rd_SubId});
            filtrosInvoice[1] = search.createFilter({name:'entity', operator:'is',values: Rd_CustId});
            filtrosInvoice[2] = search.createFilter({name:'trandate', operator:'onorbefore',values: Rd_DateId});
            filtrosInvoice[3] = search.createFilter({name:'account', operator:'is',values: Rd_AccId});
            filtrosInvoice[4] = search.createFilter({name:'currency', operator: 'is',values: Rd_CurrId});
            filtrosInvoice[5] = search.createFilter({name:'status', operator: 'anyof', values: "CustInvc:A"});
            filtrosInvoice[6] = search.createFilter({name:'mainline', operator: 'is', values: "T"});

            var columnasInvoice = [];
            columnasInvoice[0] = search.createColumn({name:'internalid', sort: search.Sort.ASC});
            columnasInvoice[1] = search.createColumn({name:'formulatext', formula: "{tranid}"});
            columnasInvoice[2] = search.createColumn({name:'trandate'});
            columnasInvoice[3] = search.createColumn({name:'custbody_lmry_document_type'});
            columnasInvoice[4] = search.createColumn({name:'currency'});
            columnasInvoice[5] = search.createColumn({name:'exchangerate'});
            columnasInvoice[6] = search.createColumn({name:'memo'});
            columnasInvoice[7] = search.createColumn({name:'fxamount'});
            columnasInvoice[8] = search.createColumn({name:'fxamountremaining'});
            columnasInvoice[9] = search.createColumn({name:'fxamountpaid'});

            var searchInvoice = search.create({type: 'invoice', filters: filtrosInvoice, columns: columnasInvoice});
            var resultInvoice = searchInvoice.run().getRange({start: 0, end: 1000});

            if(resultInvoice != null && resultInvoice.length > 0){
              var columnsInvoice = resultInvoice[0].columns;
              for(var i = 0; i < resultInvoice.length; i++){

                var idInvoice = resultInvoice[i].getValue(columnsInvoice[0]);
                if(idInvoice){
                  subtablaPay.setSublistValue({id: 'custpage_id_int', line: i, value: idInvoice});
                }

                var tranId = resultInvoice[i].getValue(columnsInvoice[1]);
                if(tranId){
                  subtablaPay.setSublistValue({id: 'custpage_id_tra', line: i, value: tranId});
                }

                var date = resultInvoice[i].getValue(columnsInvoice[2]);
                if(date){
                  subtablaPay.setSublistValue({id: 'custpage_id_date', line: i, value: date});
                }

                var docType = resultInvoice[i].getValue(columnsInvoice[3]);
                if(docType){
                  subtablaPay.setSublistValue({id: 'custpage_id_doc', line: i, value: docType});
                }

                var rate = resultInvoice[i].getValue(columnsInvoice[5]);
                if(rate){
                  subtablaPay.setSublistValue({id: 'custpage_id_exch', line: i, value: rate});
                }

                var totalAmount = resultInvoice[i].getValue(columnsInvoice[7]);
                if(totalAmount){
                  subtablaPay.setSublistValue({id: 'custpage_id_total', line: i, value: totalAmount});
                }

                var dueAmount = resultInvoice[i].getValue(columnsInvoice[8]);
                if(dueAmount){
                  subtablaPay.setSublistValue({id: 'custpage_id_due', line: i, value: dueAmount});
                }

                subtablaPay.setSublistValue({id: 'custpage_id_cm', line: i, value: 0});
                //EL INVOICE SI TIENE CM
                if(jsonCM[idInvoice] != null && jsonCM[idInvoice] != undefined){
                  subtablaPay.setSublistValue({id: 'custpage_id_cm', line: i, value: jsonCM[idInvoice]['amount']});

                  var basesCM = jsonCM[idInvoice]['gravado'] + ";" + jsonCM[idInvoice]['nogravado'] + ";" + jsonCM[idInvoice]['exento'] + ";" + jsonCM[idInvoice]['iva'];
                  subtablaPay.setSublistValue({id: 'custpage_id_bases', line: i, value: basesCM});

                }

              }
            }


            form.addButton({id: 'id_cancel',label: BtnBack,functionName: 'funcionCancel'});
            form.addSubmitButton({label:BtnSave});

          }else{
            form.addSubmitButton({label:BtnFilter});
          }

          context.response.writePage(form);

        }else{

          var _state = context.request.parameters.custpage_id_state;

          if(_state == null || _state == ''){
            redirect.toSuitelet({
                scriptId: runtime.getCurrentScript().id,
                deploymentId: runtime.getCurrentScript().deploymentId,
                parameters: {
                    'custparam_subsi': context.request.parameters.custpage_id_subsi,
                    'custparam_cust': context.request.parameters.custpage_id_customer,
                    'custparam_aracc': context.request.parameters.custpage_id_aracc,
                    'custparam_curr': context.request.parameters.custpage_id_currency,
                    'custparam_undep': context.request.parameters.custpage_id_undep,
                    'custparam_bank': context.request.parameters.custpage_id_bank,
                    'custparam_date': context.request.parameters.custpage_id_date,
                    'custparam_period': context.request.parameters.custpage_id_period,
                    'custparam_exchange': context.request.parameters.custpage_id_exchange,
                    'custparam_depart': context.request.parameters.custpage_id_depart,
                    'custparam_class': context.request.parameters.custpage_id_class,
                    'custparam_locat': context.request.parameters.custpage_id_location,
                    'custparam_method': context.request.parameters.custpage_id_method

                }
            });
          }else{

            redirect.toSuitelet({
                scriptId: 'customscript_lmry_new_latamtax_details',
                deploymentId: 'customdeploy_lmry_new_latamtax_details',
                parameters: {'param_logid': _state, 'param_useid': runtime.getCurrentUser().id}
            });

          }

        }


      }catch(msgerr){
        log.error('[ onRequest ]',msgerr);
        library.sendemail('[onRequest] ' + msgerr,LMRY_script);
      }


    }


    return {
        onRequest: onRequest
    };

});
