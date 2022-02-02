/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_WHT_ON_PAYMENTS_CLNT.js				    			    ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Set 22 2017  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 * @NModuleScope Public
 */
 define(['N/log', 'N/currency', 'N/record', 'N/format', 'N/search', 'N/runtime', 'N/currentRecord', 'N/url', 'N/query',
 './LMRY_WHT_ON_Payments_LBRY',"../Latam_Library/LMRY_libSendingEmailsLBRY_V2.0","../Latam_Library/LMRY_Log_LBRY_V2.0"],

 function (log, currency, record, format, search, runtime, currentRecord, url, query, library,library2, lbryLog) {
     /********************************
      * Variables de validacion para
      * los campos del tipo lista
      *******************************/
     var validar_payee = 0;
     var validar_depar = 0;
     var validar_class = 0;
     var validar_locat = 0;
     var validar_payme = 0;
     var validar_vendo = 0;
     //modificacion argentina
     var _bil = {};
     var globalSubi = "";
     var subsi_OW = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });

     //activacion de enable features
     var enab_dep = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });
     var enab_loc = runtime.isFeatureInEffect({ feature: "LOCATIONS" });
     var enab_clas = runtime.isFeatureInEffect({ feature: "CLASSES" });

     var LANGUAGE = runtime.getCurrentScript().getParameter({ name: 'LANGUAGE' });
     LANGUAGE = LANGUAGE.substring(0, 2);

     const NUM_VENDORS_LIMIT = 200;
     const LMRY_script  = "LMRY_WHT_ON_PAYMENTS_CLNT.js";
     const pageSize = 50;
     var licensesBySubsidiary = {};
     //Mensajes de alerta
     switch (LANGUAGE) {
         case 'es':
             var Mensaje1 = 'Campo "Subsidiaria" obligatorio';
             var Mensaje2 = 'Campo "Check #" obligatorio';
             var Mensaje3 = 'Campo "Tipo de Cambio" obligatorio';
             var Mensaje4 = 'Campo "Cuenta A/P" obligatorio';
             var Mensaje5 = 'Campo "Cuenta Bancaria" obligatorio';
             var Mensaje6 = 'Campo "Periodo Contable" obligatorio';
             var Mensaje7 = 'Campo "Beneficiario" obligatorio';
             var Mensaje8 = 'Campo "Moneda" obligatorio';
             var Mensaje9 = 'Campo "Departamento" obligatorio';
             var Mensaje10 = 'Campo "Clase" obligatorio';
             var Mensaje11 = 'Campo "Ubicación" obligatorio';
             var Mensaje12 = 'Campo "LATAM - Método de Pago" obligatorio';
             var Mensaje13 = 'Falta ingresar campo LATAM - TASA DE IMPUESTO';
             var Mensaje14 = 'El campo "Cuenta Bancaria" no pertenece a la moneda escogida';
             var Mensaje15 = 'Debe tener configurado un registro en el record "LatamReady - Setup Tax Subsidiary" para poder continuar';
             var Mensaje16 = 'Falta ingresar campo LATAM - ITEM IMPUESTO';
             var Mensaje17 = 'Seleccionar transacción: ';
             var Mensaje18 = 'Debe ingresar al menos una transacción por pagar';
             var Mensaje19 = "No hay transacciones por pagar, no se puede continuar con el proceso";
             var Mensaje20 = 'Transacción: ';
             var Mensaje21 = 'Importe ';
             var Mensaje22 = ' es mayor a ';
             var Mensaje23 = 'ingresar importe mayor a 0';
             var Mensaje24 = 'Falta ingresar campo LATAM - FECHA VIGENCIA DESDE';
             var Mensaje25 = 'Falta ingresar campo LATAM - FECHA VIGENCIA HASTA';
             var Mensaje26 = 'Falta ingresar campo LATAM - FECHA DE PUBLICACIÓN';
             var Mensaje27 = 'Falta ingresar campo LATAM - ITEM IMPUESTO';
             var Mensaje28 = 'Este proveedor no cuenta con Clases Contributivas, y tampoco hay configurado Impuesto Nacional. No se generaran retenciones';
             var Mensaje29 = 'Este número de Check ya está en uso, ingrese otro';
             var Mensaje30 = 'Hay un pago posterior a la fecha ingresada y hay national tax configurado o clase contributiva para acumular mensualmente, no se puede continuar';
             var Mensaje31 = 'Debe tener un libro con la moneda configurada en el record LatamReady - Setup Tax Subsidiary para poder continuar';
             var Mensaje32 = 'Buscar';
             var Mensaje33 = 'Búsqueda de Proveedores';
             break;

         case 'pt':
             var Mensaje1 = 'Campo "Subsidiária" obrigatório';
             var Mensaje2 = 'Campo "Check #" obrigatório';
             var Mensaje3 = 'Campo "Taxa de Câmbio" obrigatório';
             var Mensaje4 = 'Campo "Conta A/P" obrigatório';
             var Mensaje5 = 'Campo "Conta Bancária" obrigatório';
             var Mensaje6 = 'Campo "Período Contábil" obrigatório';
             var Mensaje7 = 'Campo "Beneficiário" obrigatório';
             var Mensaje8 = 'Campo "Moeda" obrigatório';
             var Mensaje9 = 'Campo "Departamento" obrigatório';
             var Mensaje10 = 'Campo "Classe" obrigatório';
             var Mensaje11 = 'Campo "Localização" obrigatório';
             var Mensaje12 = 'Campo "LATAM - Forma de Pagamento" Obligatorio';
             var Mensaje13 = 'Falta o campo LATAM - TAXA DE IMPOSTO';
             var Mensaje14 = 'O campo "Conta Bancária" não pertence à moeda escolhida';
             var Mensaje15 = 'Você deve ter configurado um registro no registro "LatamReady - Setup Tax Subsidiary" para continuar';
             var Mensaje16 = 'Falta o campo LATAM - ITEM DE IMPOSTO';
             var Mensaje17 = 'Selecione a transação: ';
             var Mensaje18 = 'Você deve inserir pelo menos uma transação para pagar';
             var Mensaje19 = "Não há transações a pagar, o processo não pode ser continuado";
             var Mensaje20 = 'Transação: ';
             var Mensaje21 = 'Quantia';
             var Mensaje22 = ' é melhor que ';
             var Mensaje23 = 'insira um valor maior que 0';
             var Mensaje24 = 'Falta o campo LATAM - DATA DE VIGÊNCIA DE';
             var Mensaje25 = 'Falta o campo LATAM - DATA DE VIGÊNCIA PARA';
             var Mensaje26 = 'Falta o campo LATAM - DATA DE PUBLICAÇÃO';
             var Mensaje27 = 'Falta o campo LATAM - CÓDIGO DE IMPOSTO';
             var Mensaje28 = 'Este provedor não tem classes de impostos e também não há impostos nacionais configurados. Nenhuma retenção será gerada';
             var Mensaje29 = 'Este número de Check já está em uso, digite outro';
             var Mensaje30 = 'Há um pagamento após a data inserida e há um imposto nacional ou classe de imposto configurada para acumular mensalmente, você não pode continuar';
             var Mensaje31 = 'Você deve ter um livro com a moeda configurada no registro LatamReady - Setup Tax Subsidiary para continuar';
             var Mensaje32 = 'Pesquisar';
             var Mensaje33 = 'Pesquisa de Fornecedores';
             break;

         default:
             var Mensaje1 = 'Mandatory "Subsidiary" field';
             var Mensaje2 = 'Mandatory "Check #" field';
             var Mensaje3 = 'Mandatory "Exchange Rate" field';
             var Mensaje4 = 'Mandatory "A/P Account" field';
             var Mensaje5 = 'Mandatory "Bank Account" field';
             var Mensaje6 = 'Mandatory "Accounting Period" field';
             var Mensaje7 = 'Mandatory "Payee" field';
             var Mensaje8 = 'Mandatory "Currency" field';
             var Mensaje9 = 'Mandatory "Department" field';
             var Mensaje10 = 'Mandatory "Class" field';
             var Mensaje11 = 'Mandatory "Location" field';
             var Mensaje12 = 'Mandatory "LATAM - Payment Method" field';
             var Mensaje13 = 'Missing field LATAM - TAX RATE';
             var Mensaje14 = 'The Bank Account field does not belong to the chosen currency';
             var Mensaje15 = 'You must have configured a record in the "LatamReady - Setup Tax Subsidiary" record in order to continue';
             var Mensaje16 = 'Missing field LATAM - TAX ITEM';
             var Mensaje17 = 'Select transaction: ';
             var Mensaje18 = 'You must enter at least one transaction to pay';
             var Mensaje19 = "There are no transactions to pay, the process cannot be continued";
             var Mensaje20 = 'Transaction: ';
             var Mensaje21 = 'Amount';
             var Mensaje22 = ' is greater than ';
             var Mensaje23 = 'enter amount greater than 0';
             var Mensaje24 = 'Missing field LATAM - EFFECTIVE DATE FROM';
             var Mensaje25 = 'Missing field LATAM - EFFECTIVE DATE TO';
             var Mensaje26 = 'Missing field LATAM - PUBLICATION DATE';
             var Mensaje27 = 'Missing field LATAM - TAX CODE';
             var Mensaje28 = 'This provider does not have Contributory Class, and there are no National Taxes configured either. No withholdings will be generated';
             var Mensaje29 = 'This check number is already in use, enter another';
             var Mensaje30 = 'There is a payment after the date entered and there is a configured national tax or contributory class to accumulate monthly, you can not continue';
             var Mensaje31 = 'You must have a book with the currency configured in the LatamReady - Setup Tax Subsidiary record in order to continue';
             var Mensaje32 = 'Search';
             var Mensaje33 = 'Vendor Search';
     }

     function pageInit(scriptContext) {
         try {
            var objRecord = scriptContext.currentRecord;
            if (objRecord.getValue({ fieldId: 'custpage_id_date' }) == null || objRecord.getValue({ fieldId: 'custpage_id_date' }) == '') {
                var newDate = new Date();
                objRecord.setValue({ fieldId: 'custpage_id_date', value: newDate });
            }
            //asignacion de color a los grupos para una mejor visualizacion
             licensesBySubsidiary = library2.getAllLicenses();
             var _sub = objRecord.getValue({ fieldId: "custpage_id_subsi" });
             if (_sub) {
                 var licenses = licensesBySubsidiary[_sub] || [];
                 var featureSeveralAccounts = library2.getAuthorization(675, licenses);
                 if (featureSeveralAccounts) {
                     const tabla = jQuery("#custpage_id_sublista_splits")[0];
                     const lineas = ((tabla.firstChild).childNodes);
                     console.log(lineas);
                     var vendorxcolor = {};
                     var color = "rgba(" + Math.random() * 255 + "," + Math.random() * 255 + "," + Math.random() * 255 + ",0.2)";
                     var account = false;
                     var accountxcolor = {};
                     for (var i = 0; i < lineas.length; i++) {
                         if (i == 0) {
                             try {
                                 const columnas = lineas[i].childNodes
                                 const texto = (columnas[5].getAttribute("data-label"));
                                 console.log(texto);
                                 if (texto == "AP Account") {
                                     account = true;
                                 }
                             } catch (err) {
                                 console.error(err);
                             }

                         }
                         if (i != 0 && i % 2 == 0) {
                             const columns = lineas[i].childNodes
                             console.log(columns);

                             if (account) {
                                 if (!accountxcolor.hasOwnProperty((((columns[5].firstChild).firstChild).firstChild).value)) {
                                     color = "rgba(" + Math.random() * 255 + "," + Math.random() * 255 + "," + Math.random() * 255 + ",0.4)";
                                     accountxcolor[(((columns[5].firstChild).firstChild).firstChild).value] = { color: color }
                                 }
                                 (((columns[5].firstChild).firstChild).firstChild).setAttribute("style", "background-color:" + accountxcolor[(((columns[5].firstChild).firstChild).firstChild).value]["color"] + " !important;color:black !important")
                             }


                         }

                     }
                 }
             }

         } catch (err) {
            console.error("[ pageInit ]", err);
            //lbryLog.doLog({ title: "[ pageInit ]", message: err, relatedScript: LMRY_script });
         }
     }

     function funcionCancel() {
         try {
             var output = url.resolveScript({
                 scriptId: 'customscript_lmry_wht_on_payments_sltl',
                 deploymentId: 'customdeploy_lmry_wht_on_payments_stlt',
                 returnExternalUrl: false
                 //antes estaba en true y se hacia el replace
             });


             //output = output.replace('forms', 'system'),
             window.location.href = output;
         } catch (msgerr) {
             // Envio de mail al clientes
             library.sendMail('LatamReady - WHT ON PAYMENTS CLNT', msgerr);
             handleError("[ functionCancel ]", msgerr);
         }

     }

     function fieldChanged(scriptContext) {

         try {
             if (scriptContext.sublistId == 'custpage_id_sublista' && scriptContext.fieldId == 'id_appl') {
                 var objRecord = scriptContext.currentRecord;
                 var selc_app = objRecord.getCurrentSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_appl' });
                 if (selc_app == true) {
                     var amt_due = objRecord.getCurrentSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_amou' });
                     objRecord.setCurrentSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_pay', value: amt_due });
                 } else {
                     objRecord.setCurrentSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_pay', value: '' });
                 }
             }
         }

         catch (msgerr) {
             library.sendMail('LatamReady - WHT ON PAYMENTS CLNT', msgerr);
             handleError("[ fieldChanged ]", msgerr);
         }

         return true;
     }

     function postSourcing(scriptContext) { }

     function sublistChanged(scriptContext) { }

     function lineInit(scriptContext) { }

     function validateField(scriptContext) {

         try {
             if (scriptContext.fieldId == 'custpage_id_subsi') {
                 var objet = scriptContext.currentRecord;
                 var sub = objet.getValue({ fieldId: "custpage_id_subsi" });
                 fillVendors(scriptContext);
                 validaraccountpayable(scriptContext);
                 fillBankAccounts(objet);
                 if (enab_dep == true) { validardepartamento(scriptContext); }
                 if (enab_clas == true) { validarclass(scriptContext); }
                 if (enab_loc == true) { validarlocation(scriptContext); }
                 validarpaymethod(scriptContext);
                 //validarVendorSubsidiaria(scriptContext);
                 //********************************** */
                 //PAY PROVIDER ACCOUNT
                //Retirada del mandatorio para el campo AP Account
                //********************************** */
                // var objet = scriptContext.currentRecord;
                // var sub = objet.getValue({ fieldId: "custpage_id_subsi" });
                // console.log(sub);
                var licenses = licensesBySubsidiary[sub] || [];
                if (library2.getAuthorization(675, licenses)) {
                    var acuenta = objet.getField({ fieldId: "custpage_id_account_pay" });
                    acuenta.isMandatory = false;
                    // acuenta.isDisabled=true;
                }


                // console.log(acuenta);

             }

             if (scriptContext.fieldId == 'custpage_id_payee') {
                 //validarcurrency(scriptContext);
                 fillCurrenciesByVendor(scriptContext.currentRecord);
                 validarVendor(scriptContext);
             }

             if (scriptContext.fieldId == 'custpage_id_curren') {
                 //validarbank(scriptContext);
                 fillBankAccounts(scriptContext.currentRecord);
                 validarSubsidiariaCurrency(scriptContext);
             }

             if (scriptContext.fieldId == 'custpage_id_date') {
                 validaraccountingperiod(scriptContext);
                 validarSubsidiariaCurrency(scriptContext);
             }

             if (scriptContext.fieldId == 'custpage_id_check') {
                 validarcheck(scriptContext);
             }

         } catch (msgerr) {
             // Envio de mail al clientes
             library.sendMail('LatamReady - WHT ON PAYMENTS CLNT', msgerr);
             handleError("[ validateField ]",  msgerr);
         }
         return true;
     }

     function validarSubsidiariaCurrency(scriptContext) {

         if (subsi_OW) {
             var objRecord = scriptContext.currentRecord;
             var sub = objRecord.getValue({ fieldId: 'custpage_id_subsi' });
             var cur = objRecord.getValue({ fieldId: 'custpage_id_curren' });
             var date = objRecord.getValue({ fieldId: 'custpage_id_date' });

             var c_currency = objRecord.getField({ fieldId: 'custpage_id_rate' });
             if (sub != null && sub != '' && sub != 0 && cur != null && cur != '' & cur != 0) {
                 var subicurr = search.lookupFields({ type: search.Type.SUBSIDIARY, id: sub, columns: ['currency'] });
                 if (subicurr.currency[0].value == cur) {
                     objRecord.setValue({ fieldId: 'custpage_id_rate', value: 1 });
                     if (!c_currency.isDisabled) {
                         c_currency.isDisabled = true;
                     }
                 } else {
                    //  var isocode_sub = search.lookupFields({ type: search.Type.CURRENCY, id: subicurr.currency[0].value, columns: ['symbol'] });
                    //  isocode_sub = isocode_sub.symbol;
                    //  var isocode_curr = search.lookupFields({ type: search.Type.CURRENCY, id: cur, columns: ['symbol'] });
                    //  isocode_curr = isocode_curr.symbol;

                     var rate = currency.exchangeRate({ source: cur, target: subicurr.currency[0].value, date: date });

                     objRecord.setValue({ fieldId: 'custpage_id_rate', value: rate });
                     if (c_currency.isDisabled) {
                         c_currency.isDisabled = false;
                     }
                 }
             } else {
                 objRecord.setValue({ fieldId: 'custpage_id_rate', value: '' });
                 c_currency.isDisabled = false;
             }
         } else {
             var objRecord = scriptContext.currentRecord;
             var cur = objRecord.getValue({ fieldId: 'custpage_id_curren' });
             var payee = objRecord.getValue({ fieldId: 'custpage_id_payee' });
             var main_currency = search.lookupFields({ type: search.Type.VENDOR, id: payee, columns: ['currency'] });

             if (main_currency.currency[0].value == cur) {
                 objRecord.setValue({ fieldId: 'custpage_id_rate', value: 1 });
             } else {
                 objRecord.setValue({ fieldId: 'custpage_id_rate', value: "" });

             }
         }
     }

     function validardepartamento(scriptContext) {

         if (subsi_OW) {
             var objRecord = scriptContext.currentRecord;
             var subs = objRecord.getValue({ fieldId: 'custpage_id_subsi' });
             var field_depart = objRecord.getField({ fieldId: 'custpage_id_depart' });

             if (validar_depar > 0) {
                 field_depart.removeSelectOption({ value: null });
             }

             var Search_depart = search.create({
                 type: search.Type.DEPARTMENT,
                 columns: ['internalid', 'name'],
                 filters: [{ name: 'subsidiary', operator: 'anyof', values: [subs] },
                 { name: 'isinactive', operator: 'is', values: 'F' }]
             });
             var searchResult = Search_depart.run().getRange({ start: 0, end: 100 });

             validar_depar = searchResult.length;
             if (searchResult != null && searchResult.length > 0) {
                 field_depart.insertSelectOption({ value: 0, text: ' ' });

                 for (var i = 0; i < searchResult.length; i++) {
                     field_depart.insertSelectOption({
                         value: searchResult[i].getValue({ name: 'internalid' }),
                         text: searchResult[i].getValue({ name: 'name' })
                     });
                 }
             }
         }
     }

     function validarclass(scriptContext) {

         if (subsi_OW) {
             var objRecord = scriptContext.currentRecord;
             var subs = objRecord.getValue({ fieldId: 'custpage_id_subsi' });
             var field_clas = objRecord.getField({ fieldId: 'custpage_id_class' });

             if (validar_class > 0) {
                 field_clas.removeSelectOption({ value: null });
             }

             var Search_clas = search.create({
                 type: search.Type.CLASSIFICATION,
                 columns: ['internalid', 'name'],
                 filters: [{ name: 'subsidiary', operator: 'anyof', values: [subs] },
                 { name: 'isinactive', operator: 'is', values: 'F' }]
             });
             var Result_class = Search_clas.run().getRange({ start: 0, end: 100 });

             validar_class = Result_class.length;
             if (Result_class != null && Result_class.length > 0) {
                 field_clas.insertSelectOption({ value: 0, text: ' ' });
                 for (var i = 0; i < Result_class.length; i++) {
                     field_clas.insertSelectOption({
                         value: Result_class[i].getValue({ name: 'internalid' }),
                         text: Result_class[i].getValue({ name: 'name' })
                     });
                 }
             }
         }
     }

     function validarlocation(scriptContext) {

         if (subsi_OW) {
             var objRecord = scriptContext.currentRecord;
             var subs = objRecord.getValue({ fieldId: 'custpage_id_subsi' });
             var field_loc = objRecord.getField({ fieldId: 'custpage_id_location' });

             if (validar_locat > 0) {
                 field_loc.removeSelectOption({ value: null });
             }

             var Search_loc = search.create({
                 type: search.Type.LOCATION,
                 columns: ['internalid', 'name'],
                 filters: [{ name: 'subsidiary', operator: 'anyof', values: [subs] },
                 { name: 'isinactive', operator: 'is', values: 'F' }]
             });

             var searchResult = Search_loc.run().getRange({ start: 0, end: 100 });

             validar_locat = searchResult.length;
             if (searchResult != null && searchResult.length > 0) {
                 field_loc.insertSelectOption({ value: 0, text: ' ' });

                 for (var i = 0; i < searchResult.length; i++) {
                     field_loc.insertSelectOption({
                         value: searchResult[i].getValue({ name: 'internalid' }),
                         text: searchResult[i].getValue({ name: 'name' })
                     });
                 }
             }
         }
     }

     function validaraccountingperiod(scriptContext) {

         var objRecord = scriptContext.currentRecord;
         var fecha = objRecord.getValue({ fieldId: 'custpage_id_date' });

         var field_accounting = objRecord.getField({ fieldId: 'custpage_id_period' });

         field_accounting.removeSelectOption({ value: null });
         field_accounting.insertSelectOption({ value: 0, text: ' ' });

         var x = format.parse({ value: fecha, type: format.Type.DATE });
         var search_period = search.load({ id: 'customsearch_lmry_open_accounting_period' });

         search_period.filters.push(search.createFilter({ name: 'isinactive', operator: 'is', values: 'F' }));

         var resul_period = search_period.run();
         var lengt_period = resul_period.getRange({ start: 0, end: 1000 });

         var period_actua = 0;

         if (lengt_period != null && lengt_period.length > 0) {
             for (var i = 0; i < lengt_period.length; i++) {
                 var perID = lengt_period[i].getValue('internalid');
                 var perNM = lengt_period[i].getValue('periodname');
                 field_accounting.insertSelectOption({ value: perID, text: perNM });

                 var a = format.parse({ value: lengt_period[i].getValue('startdate'), type: format.Type.DATE });
                 var b = format.parse({ value: lengt_period[i].getValue('enddate'), type: format.Type.DATE });

                 if (x >= a && x <= b) {
                     period_actua = lengt_period[i].getValue('internalid');
                 }
             }

             //Seteo por defecto con el record defrente, modo cliente
             objRecord.setValue({ fieldId: 'custpage_id_period', value: period_actua, ignoreFieldChange: false });

         }

     }

     function validarbank(scriptContext) {
         if (subsi_OW) {
             var objRecord = scriptContext.currentRecord;

             var subsidiaria = objRecord.getValue({ fieldId: 'custpage_id_subsi' });
             var currency = objRecord.getValue({ fieldId: 'custpage_id_curren' });
             var field_bank = objRecord.getField({ fieldId: 'custpage_id_bank' });

             field_bank.removeSelectOption({ value: null });
             field_bank.insertSelectOption({ value: 0, text: ' ' });

             var search_bank = search.load({ id: 'customsearch_lmry_wht_bank_account' });

             search_bank.filters.push(search.createFilter({ name: 'subsidiary', operator: 'anyof', values: subsidiaria }));
             search_bank.filters.push(search.createFilter({ name: 'isinactive', operator: 'is', values: 'F' }));

             var result_bank = search_bank.run().getRange({ start: 0, end: 1000 });

             if (result_bank != null && result_bank.length > 0) {
                 var columns_bank = result_bank[0].columns;
                 for (var i = 0; i < result_bank.length; i++) {
                     var valores = result_bank[i].getValue(columns_bank[0]);
                     var textos = result_bank[i].getValue(columns_bank[1]);

                     if (textos != null && textos != '') {
                         field_bank.insertSelectOption({ value: valores, text: textos });
                     }

                 }
             }
         }
     }

     function validaraccountpayable(scriptContext) {
         if (subsi_OW) {
             var objRecord = scriptContext.currentRecord;
             var subsidiaria = objRecord.getValue({ fieldId: 'custpage_id_subsi' }) || "";
             if(Number(subsidiaria)){
                var field_acc_payable = objRecord.getField({ fieldId: 'custpage_id_account_pay' });

                if (validar_payee > 0) {
                    field_acc_payable.removeSelectOption({ value: null });
                }

                var search_acc_payable = search.load({ id: 'customsearch_lmry_wht_account_payable' });
                search_acc_payable.filters.push(search.createFilter({ name: 'subsidiary', operator: 'anyof', values: subsidiaria }));
                search_acc_payable.filters.push(search.createFilter({ name: 'isinactive', operator: 'is', values: 'F' }));

                var result_acc_payable = search_acc_payable.run().getRange({ start: 0, end: 1000 });

                validar_payee = result_acc_payable.length;
                if (result_acc_payable != null && result_acc_payable.length > 0) {
                    field_acc_payable.insertSelectOption({ value: 0, text: ' ' });
                    var columns_payable = result_acc_payable[0].columns;

                    for (var i = 0; i < result_acc_payable.length; i++) {
                        var valores = result_acc_payable[i].getValue(columns_payable[0]);
                        var textos = result_acc_payable[i].getValue(columns_payable[1]);

                        if (textos != '' && textos != null) {
                            field_acc_payable.insertSelectOption({ value: valores, text: textos });
                        }

                    }
                }
            }
         }
     }

     function validarcurrency(scriptContext) {

         var objRecord = scriptContext.currentRecord;
         var vendor = objRecord.getValue({ fieldId: 'custpage_id_payee' });
         var field_currency = objRecord.getField({ fieldId: 'custpage_id_curren' });

         field_currency.removeSelectOption({ value: null });
         field_currency.insertSelectOption({ value: 0, text: ' ' });

         //var obj_currency = search.lookupFields({ type: search.Type.VENDOR, id: vendor, columns: ['currency'] });

         var array_currency = new Array();
         var b = search.createFilter({ name: 'internalid', operator: 'anyof', values: [vendor] });
         var d = search.createFilter({ name: 'isinactive', operator: 'is', values: 'F' });
         var a = search.create({
             type: search.Type.VENDOR,
             filters: [b, d],
             columns: [{ name: 'currency' }, { name: 'currency', join: 'vendorcurrencybalance' }]
         });
         var run_search = a.run().getRange({ start: 0, end: 1000 });

         //Agrega la moneda principal
         if (run_search.length > 0) {
             var col = run_search[0].columns;
             array_currency.push(run_search[0].getText(col[0]));
         }
         //Agrega las monedas secundarias
         for (var i = 0; i < run_search.length; i++) {
             var col = run_search[i].columns;
             if (array_currency[0] != run_search[i].getValue(col[1])) {
                 array_currency.push(run_search[i].getValue(col[1]));
             }
         }

         var array_currency_internal = new Array();

         //Sort: porque al leer la busqueda lo iteraba por nombre no por id
         var c = search.create({
             type: search.Type.CURRENCY,
             columns: [{ name: 'internalid', sort: search.Sort.ASC }, { name: 'name' }]
         });
         var run_c = c.run().getRange({ start: 0, end: 1000 });

         if (run_c != null && run_c.length > 0) {
             for (var i = 0; i < array_currency.length; i++) {
                 for (var j = 0; j < run_c.length; j++) {
                     if (run_c[j].getValue({ name: 'name' }) == array_currency[i]) {
                         array_currency_internal.push(run_c[j].getValue({ name: 'internalid' }));
                     }
                 }
             }
         }

         for (var k = 0; k < array_currency_internal.length; k++) {
             field_currency.insertSelectOption({ value: array_currency_internal[k], text: array_currency[k] });
         }
     }

     function validarpaymethod(scriptContext) {

         if (subsi_OW) {
             var objRecord = scriptContext.currentRecord;
             var subs = objRecord.getValue({ fieldId: 'custpage_id_subsi' });
             if(Number(subs)){
                var rcd_country = search.lookupFields({ type: search.Type.SUBSIDIARY, id: subs, columns: ['country'] });
                var country = rcd_country.country[0].text;

                var field_met = objRecord.getField({ fieldId: 'custpage_id_method' });

                if (validar_payme > 0) {
                    field_met.removeSelectOption({ value: null });
                }

                var Search_met = search.create({
                    type: 'customrecord_lmry_paymentmethod',
                    columns: ['internalid', 'name', 'custrecord_lmry_country_pm'],
                    filters: [{ name: 'isinactive', operator: 'is', values: 'F' }]
                });

                var searchResult = Search_met.run().getRange({ start: 0, end: 100 });

                validar_payme = searchResult.length;
                if (searchResult != null && searchResult.length > 0) {
                    field_met.insertSelectOption({ value: 0, text: ' ' });
                    for (var i = 0; i < searchResult.length; i++) {
                        var res_cont = searchResult[i].getText({ name: 'custrecord_lmry_country_pm' });
                        if (country == res_cont) {
                            field_met.insertSelectOption({
                                value: searchResult[i].getValue({ name: 'internalid' }),
                                text: searchResult[i].getValue({ name: 'name' })
                            });
                        }
                    }
                }
            }
         }
     }

     function validarVendorSubsidiaria(scriptContext) {

         if (subsi_OW) {
             var objRecord = scriptContext.currentRecord;
             var subs = objRecord.getValue({ fieldId: 'custpage_id_subsi' });
             var field_vendor = objRecord.getField({ fieldId: 'custpage_id_payee' });

             if (validar_vendo > 0) {
                 field_vendor.removeSelectOption({ value: null });
             }

             var filtros_payee = new Array();
             filtros_payee[0] = search.createFilter({ name: 'isinactive', operator: 'is', values: 'F' });
             filtros_payee[1] = search.createFilter({ name: 'formulanumeric', formula: '{msesubsidiary.internalid}', operator: search.Operator.EQUALTO, values: subs });

             var m1 = search.create({
                 type: search.Type.VENDOR,
                 filters: filtros_payee,
                 columns: ['internalid', 'entityid', 'companyname', 'firstname', 'lastname', 'isperson', 'middlename']
             });

             var m2 = m1.run();
             var m3 = m2.getRange({ start: 0, end: 1000 });

             var contador = 0;
             var bandera = true;

             validar_vendo = m3.length;
             if (m3 != null && m3.length > 0) {
                 field_vendor.insertSelectOption({ value: 0, text: ' ' });
                 while (bandera) {
                     m3 = m2.getRange({ start: contador, end: contador + 1000 });

                     for (var i = 0; i < m3.length; i++) {
                         var valores1, textos1 = "";
                         valores1 = m3[i].getValue({ name: 'internalid' });
                         if (m3[i].getValue({ name: 'isperson' })) {
                             textos1 = m3[i].getValue({ name: 'firstname' }) + " ";
                             if (m3[i].getValue({ name: 'middlename' }) != null && m3[i].getValue({ name: 'middlename' }) != '') {
                                 textos1 = textos1 + m3[i].getValue({ name: 'middlename' }).substring(0, 1) + " ";
                             }
                             textos1 = textos1 + m3[i].getValue({ name: 'lastname' });
                         } else {
                             if (m3[i].getValue({ name: 'companyname' }) != null && m3[i].getValue({ name: 'companyname' }) != "") {
                                 textos1 = m3[i].getValue({ name: 'companyname' });
                             } else {
                                 textos1 = m3[i].getValue({ name: 'entityid' });
                             }
                         }

                         field_vendor.insertSelectOption({ value: valores1, text: textos1 });

                     }
                     if (m3.length != 1000) {
                         bandera = false;
                         contador = contador + m3.length;
                     } else {
                         contador = contador + 1000;
                     }
                 }
             }
         }
     }

     function validarVendor(scriptContext) {

         var objRecord = scriptContext.currentRecord;

         var vendr = objRecord.getValue({ fieldId: 'custpage_id_payee' });
         var fecha = objRecord.getValue({ fieldId: 'custpage_id_date' });

         var subsidiaria = "";
         if (subsi_OW) {
             subsidiaria = objRecord.getValue({ fieldId: 'custpage_id_subsi' });
         }

         fecha = format.format({ value: fecha, type: format.Type.DATE });

         var Search_contri_clas = search.create({
             type: 'customrecord_lmry_ar_contrib_class',
             columns: ['custrecord_lmry_ar_ccl_taxitem', 'custrecord_lmry_ar_ccl_taxrate', 'custrecord_lmry_ar_ccl_fechdesd',
                 'custrecord_lmry_ar_ccl_fechpubl', 'custrecord_lmry_ar_ccl_taxcode', 'internalid', 'custrecord_lmry_ar_ccl_fechhast'
             ],
             filters: [
                 { name: 'custrecord_lmry_ar_ccl_entity', operator: 'anyof', values: [vendr] },
                 { name: 'isinactive', operator: 'is', values: ['F'] },
                 { name: 'custrecord_lmry_ar_ccl_fechdesd', operator: 'onorbefore', values: fecha },
                 { name: 'custrecord_lmry_ar_ccl_fechhast', operator: 'onorafter', values: fecha },
                 { name: 'custrecord_lmry_ccl_taxtype', operator: 'is', values: [1] },
                 { name: 'custrecord_lmry_ccl_gen_transaction', operator: 'is', values: [3] }
             ]
         });

         var Result_contri_clas = Search_contri_clas.run().getRange({ start: 0, end: 1000 });

         var filtros_ntaxes = new Array();
         filtros_ntaxes[0] = search.createFilter({ name: 'isinactive', operator: 'is', values: ['F'] });
         filtros_ntaxes[1] = search.createFilter({ name: 'custrecord_lmry_ntax_datefrom', operator: 'onorbefore', values: fecha });
         filtros_ntaxes[2] = search.createFilter({ name: 'custrecord_lmry_ntax_dateto', operator: 'onorafter', values: fecha });
         filtros_ntaxes[3] = search.createFilter({ name: 'custrecord_lmry_ntax_taxtype', operator: 'is', values: [1] });
         filtros_ntaxes[4] = search.createFilter({ name: 'custrecord_lmry_ntax_gen_transaction', operator: 'anyof', values: ['3'] });
         if (subsi_OW) {
             filtros_ntaxes[5] = search.createFilter({ name: 'custrecord_lmry_ntax_subsidiary', operator: 'is', values: subsidiaria });
         }

         var Search_ntax = search.create({
             type: 'customrecord_lmry_national_taxes',
             columns: ['custrecord_lmry_ntax_taxitem', 'custrecord_lmry_ntax_taxrate', 'custrecord_lmry_ntax_datefrom', 'custrecord_lmry_ntax_dateto',
                 'custrecord_lmry_ntax_publdate', 'custrecord_lmry_ntax_taxcode', 'internalid'],
             filters: filtros_ntaxes
         });

         var Result_ntax = Search_ntax.run().getRange({ start: 0, end: 1000 });

         var mensaje = '';
         if (Result_ntax != null && Result_ntax.length > 0) {
             for (var j = 0; j < Result_ntax.length; j++) {
                 var clas_id = Result_ntax[j].getValue({ name: 'internalid' });
                 var tax_rate = Result_ntax[j].getValue({ name: 'custrecord_lmry_ntax_taxrate' });
                 var tax_item = Result_ntax[j].getValue({ name: 'custrecord_lmry_ntax_taxitem' });
                 var ini_date = Result_ntax[j].getValue({ name: 'custrecord_lmry_ntax_datefrom' });
                 var fin_date = Result_ntax[j].getValue({ name: 'custrecord_lmry_ntax_dateto' });
                 var pub_date = Result_ntax[j].getValue({ name: 'custrecord_lmry_ntax_publdate' });
                 var tax_code = Result_ntax[j].getValue({ name: 'custrecord_lmry_ntax_taxcode' });

                 if (tax_rate == null || tax_rate == '') {
                     mensaje += ' National Tax: ' + clas_id + ' , ' + Mensaje13 + '\n';
                     alert(mensaje);
                     return false;
                 }

                 if (tax_item == null || tax_item == '') {
                     mensaje += ' National Tax: ' + clas_id + ' , ' + Mensaje16 + '\n';
                     alert(mensaje);
                     return false;
                 }
                 if (ini_date == null || ini_date == '') {
                     mensaje += ' National Tax: ' + clas_id + ' , ' + Mensaje24 + '\n';
                     alert(mensaje);
                     return false;
                 }
                 if (fin_date == null || fin_date == '') {
                     mensaje += ' National Tax: ' + clas_id + ' , ' + Mensaje25 + '\n';
                     alert(mensaje);
                     return false;
                 }
                 if (pub_date == null || pub_date == '') {
                     mensaje += ' National Tax: ' + clas_id + ' , ' + Mensaje26 + '\n';
                     alert(mensaje);
                     return false;
                 }
                 if (tax_code == null || tax_code == '') {
                     mensaje += ' National Tax: ' + clas_id + ' , ' + Mensaje27 + '\n';
                     alert(mensaje);
                     return false;
                 }
             }
         }

         if (Result_contri_clas != null && Result_contri_clas.length > 0) {
             for (var i = 0; i < Result_contri_clas.length; i++) {
                 var clas_id = Result_contri_clas[i].getValue({ name: 'internalid' });
                 var tax_rate = Result_contri_clas[i].getValue({ name: 'custrecord_lmry_ar_ccl_taxrate' });
                 var tax_item = Result_contri_clas[i].getValue({ name: 'custrecord_lmry_ar_ccl_taxitem' });
                 var ini_date = Result_contri_clas[i].getValue({ name: 'custrecord_lmry_ar_ccl_fechdesd' });
                 var fin_date = Result_contri_clas[i].getValue({ name: 'custrecord_lmry_ar_ccl_fechhast' });
                 var pub_date = Result_contri_clas[i].getValue({ name: 'custrecord_lmry_ar_ccl_fechpubl' });
                 var tax_code = Result_contri_clas[i].getValue({ name: 'custrecord_lmry_ar_ccl_taxcode' });

                 if (tax_rate == null || tax_rate == '') {
                     mensaje += ' Contributory Class: ' + clas_id + ' , ' + Mensaje13 + '\n';
                     alert(mensaje);
                     return false;
                 }

                 if (tax_item == null || tax_item == '') {
                     mensaje += ' Contributory Class: ' + clas_id + ' , ' + Mensaje16 + '\n';
                     alert(mensaje);
                     return false;
                 }
                 if (ini_date == null || ini_date == '') {
                     mensaje += ' Contributory Class: ' + clas_id + ' , ' + Mensaje24 + '\n';
                     alert(mensaje);
                     return false;
                 }
                 if (fin_date == null || fin_date == '') {
                     mensaje += ' Contributory Class: ' + clas_id + ' , ' + Mensaje25 + '\n';
                     alert(mensaje);
                     return false;
                 }
                 if (pub_date == null || pub_date == '') {
                     mensaje += ' Contributory Class: ' + clas_id + ' , ' + Mensaje26 + '\n';
                     alert(mensaje);
                     return false;
                 }
                 if (tax_code == null || tax_code == '') {
                     mensaje += ' Contributory Class: ' + clas_id + ' , ' + Mensaje27 + '\n';
                     alert(mensaje);
                     return false;
                 }
             }
         }

         if (Result_contri_clas.length == 0 && Result_ntax.length == 0) {
             mensaje += Mensaje28 + '\n';
             alert(mensaje);
             //return false;
         }
     }

     function validarcheck(scriptContext) {
         var objRecord = scriptContext.currentRecord;
         var check = objRecord.getValue({ fieldId: 'custpage_id_check' }) || "";
         check = check.trim();

         if (check) {
             //var filtro_a = search.createFilter({ name: 'custrecord_lmry_wht_sta', operator: search.Operator.IS, values: ['FINALIZADO'] });
             var filtro_a = [
                 ["custrecord_lmry_wht_che", "is", check], "AND",
                 ["custrecord_lmry_wht_sta", "is", "FINALIZADO"]
             ];
             var cargado = search.create({ type: 'customrecord_lmry_wht_payments_log', columns: ['custrecord_lmry_wht_che', 'internalid'], filters: filtro_a });

             var result_cargado = cargado.run().getRange({ start: 0, end: 10 });

             var mensaje = "";
             if (result_cargado != null && result_cargado.length > 0) {
                 mensaje = Mensaje29;
                 return false;
             }
         }
         return true;

        //  if (result_cargado != null && result_cargado.length > 0) {
        //      for (var i = 0; i < result_cargado.length; i++) {
        //          var a = result_cargado[i].getValue({ name: 'custrecord_lmry_wht_che' });
        //          if (a == check) {
        //              if (a != null && a != '') {
        //                  mensaje = Mensaje29;
        //                  return false;
        //              }
        //          }
        //      }
        //  }
     }

     function validateLine(scriptContext) { }

     function validateInsert(scriptContext) { }

     function validateDelete(scriptContext) { }

     function saveRecord(scriptContext) {
         try {
             // Objetos del Formulario
             var objRecord = scriptContext.currentRecord;
             var UserID = runtime.getCurrentUser().id;
             if (subsi_OW) {
                 var _sub = objRecord.getValue({ fieldId: 'custpage_id_subsi' });
             } else {
                 var _sub = "Mismarket Edition";
             }
             var _pay = objRecord.getValue({ fieldId: 'custpage_id_payee' });
             var _ban = objRecord.getValue({ fieldId: 'custpage_id_bank' });

             var _rat = objRecord.getValue({ fieldId: 'custpage_id_rate' });

             var _acc = objRecord.getValue({ fieldId: "custpage_id_account_pay" });

             var _cur = objRecord.getValue({ fieldId: 'custpage_id_curren' });

             var _per = objRecord.getValue({ fieldId: 'custpage_id_period' });

             var _date = objRecord.getValue({ fieldId: 'custpage_id_date' });

             var _che = objRecord.getValue({ fieldId: 'custpage_id_check' });

             var _mem = objRecord.getValue({ fieldId: 'id_memo' });

             var _dep = objRecord.getValue({ fieldId: 'custpage_id_depart' });

             var _loc = objRecord.getValue({ fieldId: 'custpage_id_location' });

             var _cla = objRecord.getValue({ fieldId: 'custpage_id_class' });

             var _met = objRecord.getValue({ fieldId: 'custpage_id_method' });

             var licenses = licensesBySubsidiary[_sub] || [];
             var multicuenta=library2.getAuthorization(675, licenses);
             //modificacion argentina
             var apaccount = [];
             if (_acc != null || _acc != "") {
                 if (_acc != 0) {
                     apaccount.push(_acc);
                 }
             }
             // Variable Estado
             var idsta = objRecord.getValue({ fieldId: 'id_state' });


             var _eft = '';
             var filtros = new Array();
             filtros[0] = search.createFilter({ name: 'isinactive', operator: 'is', values: ['F'] });
             if (subsi_OW) {
                 filtros[1] = search.createFilter({ name: 'custrecord_lmry_setuptax_subsidiary', operator: 'is', values: _sub });
             }
             var search_setup = search.create({ type: 'customrecord_lmry_setup_tax_subsidiary', filters: filtros,
             columns: ['custrecord_lmry_setuptax_elec_payment','custrecord_lmry_setuptax_currency','custrecord_lmry_setuptax_check'] });
             var result_search_setup = search_setup.run().getRange({ start: 0, end: 1 });
             if (result_search_setup != null && result_search_setup.length > 0) {
                 var campo_eft = result_search_setup[0].getValue({ name: 'custrecord_lmry_setuptax_elec_payment' });

                 if (campo_eft) {
                     _eft = objRecord.getValue({ fieldId: 'custpage_id_eft' });
                 }
             }

             if (idsta == '' || idsta == null) {
                 //activacion de enable features
                 var enab_dep = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });
                 var enab_loc = runtime.isFeatureInEffect({ feature: "LOCATIONS" });
                 var enab_clas = runtime.isFeatureInEffect({ feature: "CLASSES" });

                 //activacion de Accounting Preferences
                 var userObj = runtime.getCurrentUser();
                 var pref_dep = userObj.getPreference({ name: "DEPTMANDATORY" });
                 var pref_loc = userObj.getPreference({ name: "LOCMANDATORY" });
                 var pref_clas = userObj.getPreference({ name: "CLASSMANDATORY" });

                 // Validar campos
                 console.log('_sub', _sub);
                 if (_sub == null || _sub == '' || _sub == 0) {
                     console.log('Sub');
                     alert(Mensaje1);
                     return false;
                 }
                 if ((apaccount.length == 0 && !multicuenta) || apaccount[0] == 0) {
                     alert(Mensaje4);
                     return false;
                 }
                 if (_pay == null || _pay == '') {
                     alert(Mensaje7);
                     return false;
                 }
                 if (_cur == null || _cur == '') {
                     alert(Mensaje8);
                     return false;
                 }
                 if (_ban == 0) {
                     alert(Mensaje5);
                     return false;
                 }
                 if (_per == 0) {
                     alert(Mensaje6);
                     return false;
                 }
                 if (_rat == null || _rat == '') {
                     alert(Mensaje3);
                     return false;
                 }

                 if (enab_dep == true) {
                     if (pref_dep == true) {
                         if (_dep == 0) {
                             alert(Mensaje9);
                             return false;
                         }
                     }
                 }
                 if (enab_clas == true) {
                     if (pref_clas == true) {
                         if (_cla == 0) {
                             alert(Mensaje10);
                             return false;
                         }
                     }
                 }
                 if (enab_loc == true) {
                     if (pref_loc == true) {
                         if (_loc == 0) {
                             alert(Mensaje11);
                             return false;
                         }
                     }
                 }

                 if (_met == 0) {
                     alert(Mensaje12);
                     return false;
                 }

                 //validar llenado de contributory class en vendor
                 var cont_clas_vend = validarVendor(scriptContext);
                 if (cont_clas_vend == false) {
                     return false;
                 }

                 //validar Currency en subsidiary
                 //var curren_sub = validarSubsidiariaCurrency(scriptContext);
                 //if (curren_sub == false) {
                 //    return false;
                 //}

                 // valida que currency pertenezca a bank account
                //  if ((_ban != null && _ban != '') && (_cur != null && _cur != '')) {
                //      if (subsi_OW) {
                //          var accRecord = record.load({ type: record.Type.ACCOUNT, id: _ban, isDynamic: true });
                //          var axcur = accRecord.getValue('currency');

                //          var currency_subsidiaria = search.lookupFields({ type: search.Type.SUBSIDIARY, id: _sub, columns: ['currency'] });
                //          currency_subsidiaria = currency_subsidiaria.currency[0].value;

                //          if (_cur == currency_subsidiaria) {
                //              if (axcur != _cur) {
                //                  alert(Mensaje14);
                //                  return false;
                //              }
                //          } else {
                //              if (axcur != _cur && axcur != currency_subsidiaria) {
                //                  alert(Mensaje14);
                //                  return false;
                //              }
                //          }

                //      }
                //  }

                 //VALIDACION QUE NO HALLA UN PAGO POSTERIOR A LA FECHA INGRESADA EN EL MISMO PERIODO CONTABLE
                 var aux_date = format.format({ value: _date, type: format.Type.DATE });
                 var valid_fecha_pago = search.create({
                     type: "customrecord_lmry_wht_payments_log",
                     filters: [["formulatext: {custrecord_lmry_wht_tra}", "isnotempty", ""], "AND",
                     ["custrecord_lmry_wht_tra.trandate", "after", aux_date], "AND",
                     ["custrecord_lmry_wht_per", "anyof", _per], "AND", ["custrecord_lmry_wht_ven", "anyof", _pay]],
                     columns: [search.createColumn({ name: "internalid", sort: search.Sort.DESC, label: "Internal ID" })]
                 });

                 var result_fecha_pago = valid_fecha_pago.run().getRange({ start: 0, end: 1 });
                 var fecha = format.format({ value: _date, type: format.Type.DATE });

                 var filtros_nt_acum = new Array();
                 filtros_nt_acum[0] = search.createFilter({ name: 'custrecord_lmry_ntax_datefrom', operator: 'onorbefore', values: fecha });
                 filtros_nt_acum[1] = search.createFilter({ name: 'custrecord_lmry_ntax_dateto', operator: 'onorafter', values: fecha });
                 filtros_nt_acum[2] = search.createFilter({ name: 'custrecord_lmry_ntax_taxtype', operator: 'is', values: [1] });
                 filtros_nt_acum[3] = search.createFilter({ name: 'isinactive', operator: 'is', values: ['F'] });
                 filtros_nt_acum[4] = search.createFilter({ name: 'custrecord_lmry_ntax_montaccum', operator: 'is', values: ['T'] });
                 filtros_nt_acum[5] = search.createFilter({ name: 'custrecord_lmry_ntax_gen_transaction', operator: 'is', values: [3] });
                 if (subsi_OW) {
                     filtros_nt_acum[6] = search.createFilter({ name: 'custrecord_lmry_ntax_subsidiary', operator: 'is', values: _sub });
                 }

                 var national_acum = search.create({
                     type: 'customrecord_lmry_national_taxes', filters: filtros_nt_acum,
                     columns: ['internalid']
                 });

                 var result_national_acum = national_acum.run().getRange({ start: 0, end: 1 });

                 var filtros_cc_acum = new Array();
                 filtros_cc_acum[0] = search.createFilter({ name: 'custrecord_lmry_ar_ccl_fechdesd', operator: 'onorbefore', values: fecha });
                 filtros_cc_acum[1] = search.createFilter({ name: 'custrecord_lmry_ar_ccl_fechhast', operator: 'onorafter', values: fecha });
                 filtros_cc_acum[2] = search.createFilter({ name: 'custrecord_lmry_ccl_taxtype', operator: 'is', values: [1] });
                 filtros_cc_acum[3] = search.createFilter({ name: 'isinactive', operator: 'is', values: ['F'] });
                 filtros_cc_acum[4] = search.createFilter({ name: 'custrecord_lmry_ccl_montaccum', operator: 'is', values: ['T'] });
                 filtros_cc_acum[5] = search.createFilter({ name: 'custrecord_lmry_ar_ccl_entity', operator: 'is', values: _pay });
                 filtros_cc_acum[6] = search.createFilter({ name: 'custrecord_lmry_ccl_gen_transaction', operator: 'is', values: [3] });
                 if (subsi_OW) {
                     filtros_cc_acum[7] = search.createFilter({ name: 'custrecord_lmry_ar_ccl_subsidiary', operator: 'is', values: _sub });
                 }

                 var ccl_acum = search.create({ type: 'customrecord_lmry_ar_contrib_class', filters: filtros_cc_acum, columns: ['internalid'] });
                 var result_ccl_acum = ccl_acum.run().getRange({ start: 0, end: 1 });

                 if (result_fecha_pago.length > 0 && (result_national_acum.length > 0 || result_ccl_acum.length > 0)) {
                     alert(Mensaje30);
                     return false;
                 }

                 //VALIDACION DEBE TENER UN REGISTRO EN EL RECORD SETUP TAX SUBSIDIARY
                //  var filtros_setup = new Array();
                //  filtros_setup[0] = search.createFilter({ name: 'isinactive', operator: 'is', values: ['F'] });
                //  if (subsi_OW) {
                //      filtros_setup[1] = search.createFilter({ name: 'custrecord_lmry_setuptax_subsidiary', operator: 'anyof', values: _sub });
                //  }

                //  var search_setup = search.create({ type: 'customrecord_lmry_setup_tax_subsidiary', columns: ['internalid'], filters: filtros_setup });
                //  var result_setup = search_setup.run().getRange({ start: 0, end: 1 });

                 if (result_search_setup.length == 0) {
                     alert(Mensaje15);
                     return false;
                 }


             } else {
                 // Para el segundo Proceso

                 var curren_check = validarcheck(scriptContext);
                 if (curren_check == false) {
                     alert(Mensaje29);
                     return false;
                 }

                 var setupTaxSearch ="";

                 //VALIDAR MULTIBOOKING
                 var featureMB = runtime.isFeatureInEffect({ feature: "MULTIBOOK" });
                 if (subsi_OW && featureMB) {

                    //  var search_multibooking = search.create({ type: 'customrecord_lmry_setup_tax_subsidiary', columns: ['custrecord_lmry_setuptax_currency'], filters: filtros });
                    //  var result_multibooking = search_multibooking.run().getRange({ start: 0, end: 1 });

                     var currency_setup = result_search_setup[0].getValue({ name: 'custrecord_lmry_setuptax_currency' });
                     var currency_setup_text = result_search_setup[0].getText({ name: 'custrecord_lmry_setuptax_currency' });

                     var currency_sub = search.lookupFields({ type: search.Type.SUBSIDIARY, id: _sub, columns: ['currency'] });
                     currency_sub = currency_sub.currency[0].value;

                     var multibooking_flag = false;
                     if (currency_setup != currency_sub && currency_setup != _cur) {
                         multibooking_flag = true;
                     }

                     if (multibooking_flag) {

                         var mbook = "";
                         var flag_libro = false;

                         var row_mbook = objRecord.getLineCount({ sublistId: 'custpage_id_sublista_book' });

                         if (row_mbook > 0) {
                             for (var r = 0; r < row_mbook; r++) {
                                 var currency_book = objRecord.getSublistText({ sublistId: 'custpage_id_sublista_book', fieldId: 'custpage_id_currency', line: r });
                                 var exrate_book = objRecord.getSublistValue({ sublistId: 'custpage_id_sublista_book', fieldId: 'custpage_id_rate_book', line: r });
                                 if (currency_setup_text == currency_book) {
                                     flag_libro = true;
                                 }
                                 mbook = mbook + currency_book + ";" + exrate_book + "|";
                             }
                         }

                         if (!flag_libro) {
                             alert(Mensaje31);
                             return false;
                         }
                     }
                 }

                 // VALIDAR SELECCION
                 var row = objRecord.getLineCount({ sublistId: 'custpage_id_sublista' });

                 var cant = 0;
                 if (row > 0) {
                     var mandatory_check = false;
                    //  var filtros = new Array();
                    //  filtros[0] = search.createFilter({ name: 'isinactive', operator: 'is', values: ['F'] });
                    //  if (subsi_OW) {
                    //      filtros[1] = search.createFilter({ name: 'custrecord_lmry_setuptax_subsidiary', operator: 'is', values: _sub });
                    //  }
                    //  var search_setup = search.create({ type: 'customrecord_lmry_setup_tax_subsidiary', filters: filtros, columns: ['custrecord_lmry_setuptax_check'] });
                    //  var result_search_setup = search_setup.run().getRange({ start: 0, end: 1 });
                     if (result_search_setup != null && result_search_setup.length > 0) {
                         mandatory_check = result_search_setup[0].getValue({ name: 'custrecord_lmry_setuptax_check' });

                     }

                     if (!Number(_che) && mandatory_check == true && !multicuenta) {
                         alert(Mensaje2);
                         return false;
                     }

                     for (var j = 0; j < row; j++) {
                         var appl = objRecord.getSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_appl', line: j });
                         if (appl == false) {
                             cant++;
                         }

                         if (multicuenta && (_acc == "" || _acc == null || _acc == 0) && appl == true) {
                             var cuenta = objRecord.getSublistValue({
                                 sublistId: "custpage_id_sublista",
                                 fieldId: "id_account",
                                 line: j,
                             });

                             if (!apaccount.includes(cuenta)) {
                                 apaccount.push(cuenta);

                                 _bil[cuenta] = "";

                             }

                         } else {
                             _bil[_acc] = "";
                         }
                         var pay = objRecord.getSublistValue({
                             sublistId: "custpage_id_sublista",
                             fieldId: "id_pay",
                             line: j,
                         });
                         var tran = objRecord.getSublistValue({
                             sublistId: "custpage_id_sublista",
                             fieldId: "id_int",
                             line: j,
                         });

                         var desa = ' ';
                         if ((pay != null && pay != '') && (appl == false)) {
                             desa += Mensaje17 + tran + '\n';
                             alert(desa);
                             return false;
                         }
                     }

                     // Valida los importe ingresados
                     cont = 0;
                     var resul = validarpayment(scriptContext);

                     if (!resul) {
                         return false
                     }

                     if (cant == row) {
                         var mens = ' ';
                         mens += Mensaje18 + mens + '\n';
                         alert(mens);
                         return false;
                     }
                 } else {
                     alert(Mensaje19);
                     return false;
                 }


                 // USAR RECORD WHT Payments log
                 var _doc = '';
                 var jsonCreditLog = {};
                 var cant = objRecord.getLineCount({ sublistId: 'custpage_id_sublista' });

                 if (cant > 0) {
                     for (var i = 0; i < cant; i++) {
                         var s_appl = objRecord.getSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_appl', line: i });
                         var s_intr = objRecord.getSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_int', line: i });
                         var s_doc = objRecord.getSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_doc', line: i });
                         var s_am_rem = objRecord.getSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_amou', line: i });
                         var s_paym = objRecord.getSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_pay', line: i });
                         var s_montobill = objRecord.getSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_tota', line: i });
                         var s_billcredit = objRecord.getSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_cred', line: i });

                         if (s_appl == true) {

                             //modificacion rgentina
                             if (_acc == null || _acc == "" || _acc == 0) {
                                 var cuenta = objRecord.getSublistValue({
                                     sublistId: "custpage_id_sublista",
                                     fieldId: "id_account",
                                     line: i,
                                 });
                                 // Internal ID y Importe
                                 _bil[cuenta] = _bil[cuenta] + s_intr + ";" + s_paym + ";" + s_am_rem + ";" + s_montobill + "|";
                                 _doc = _doc + s_intr + ";" + s_doc + "|";
                                 console.log(cuenta);
                             } else {
                                 _bil[_acc] = _bil[_acc] + s_intr + ";" + s_paym + ";" + s_am_rem + ";" + s_montobill + "|";
                                 _doc = _doc + s_intr + ";" + s_doc + "|";
                             }

                             if (parseFloat(s_billcredit) > 0) {
                                 var jsonCredit = objRecord.getSublistValue({
                                     sublistId: "custpage_id_sublista",
                                     fieldId: "id_json",
                                     line: i,
                                 });
                                 jsonCredit = JSON.parse(jsonCredit);

                                 jsonCreditLog[s_intr] = jsonCredit;

                             }

                         }
                     }
                 }

                 // validar para poder guardar los datos
                 //modificacion argentina
                 var dataLog = [];
                 var alogic = [];
                 apaccount = apaccount.filter(function (dato) {
                 return dato != undefined;
                 });
                 for (var index = 0; index < apaccount.length; index++) {
                     var logObj = {};
                     if (mbook) {
                         logObj.mbook = mbook;
                     }

                     if (_sub) {
                         logObj.subsidiary = _sub;
                     }

                     logObj.status = 'Preview';
                     logObj.vendor = _pay;
                     logObj.bills = _bil[apaccount[index]];
                     logObj.doc = _doc;
                     logObj.apaccount = apaccount[index];
                     logObj.currency = _cur;
                     logObj.bankAcc = _ban;
                     logObj.date = _date;
                     logObj.rate = _rat;
                     logObj.period = _per;
                     logObj.check = _che;
                     if (_eft != null && _eft != '') {
                         logObj.eft = _eft;
                     }

                     if (_mem != null && _mem != '') {
                         logObj.memo = _mem;
                     }
                     if (_dep != null && _dep != '' && _dep != 0) {
                         logObj.department = _dep;
                     }

                     if (_loc != null && _loc != '' && _loc != 0) {
                         logObj.location = _loc;
                     }

                     if (_cla != null && _cla != '' && _cla != 0) {
                         logObj.cla = _cla;
                     }

                     logObj.method = _met;

                     if (Object.keys(jsonCreditLog).length) {
                         logObj.credits = jsonCreditLog;
                     }

                     // Graba Log
                     dataLog.push(logObj);
                     //  var wht_log = record.create({
                     //     type: 'customrecord_lmry_wht_payments_log',
                     //     isDynamic: true
                     // });

                     // if (mbook != null && mbook != '') {
                     //     wht_log.setValue({ fieldId: 'custrecord_lmry_wht_mul', value: mbook });
                     // }

                     // if (_sub != null && _sub != '') {
                     //     wht_log.setValue({ fieldId: 'custrecord_lmry_wht_sub', value: _sub });
                     // }

                     // wht_log.setValue({ fieldId: 'custrecord_lmry_wht_sta', value: 'Preview' });

                     // wht_log.setValue({ fieldId: 'custrecord_lmry_wht_ven', value: _pay });

                     // wht_log.setValue({
                     //     fieldId: "custrecord_lmry_wht_bil",
                     //     value: _bil[apaccount[index]],
                     //   });

                     // wht_log.setValue({ fieldId: 'custrecord_lmry_wht_doc', value: _doc });

                     // //modificacion argentina

                     // wht_log.setValue({
                     //     fieldId: "custrecord_lmry_wht_acc",
                     //     value: apaccount[index],
                     // });

                     // wht_log.setValue({ fieldId: 'custrecord_lmry_wht_cur', value: _cur });

                     // wht_log.setValue({ fieldId: 'custrecord_lmry_wht_ban', value: _ban });

                     // wht_log.setValue({ fieldId: 'custrecord_lmry_wht_dat', value: _date });

                     // wht_log.setValue({ fieldId: 'custrecord_lmry_wht_per', value: _per });

                     // wht_log.setValue({ fieldId: 'custrecord_lmry_wht_exc', value: _rat });

                     // wht_log.setValue({ fieldId: 'custrecord_lmry_wht_che', value: _che });

                     // if (_eft != null && _eft != '') {
                     //     wht_log.setValue({ fieldId: 'custrecord_lmry_wht_eft', value: _eft });
                     // }

                     // /*if (UserID != null && UserID != '')
                     // {
                     //     wht_log.setValue ({ fieldId: 'custrecord_lmry_wht_emp', value :  UserID});
                     // }*/

                     // if (_mem != null && _mem != '') {
                     //     wht_log.setValue({ fieldId: 'custrecord_lmry_wht_mem', value: _mem });
                     // }

                     // if (_dep != null && _dep != '' && _dep != 0) {
                     //     wht_log.setValue({ fieldId: 'custrecord_lmry_wht_dep', value: _dep });
                     // }

                     // if (_loc != null && _loc != '' && _loc != 0) {
                     //     wht_log.setValue({ fieldId: 'custrecord_lmry_wht_loc', value: _loc });
                     // }

                     // if (_cla != null && _cla != '' && _cla != 0) {
                     //     wht_log.setValue({ fieldId: 'custrecord_lmry_wht_cla', value: _cla });
                     // }

                     // wht_log.setValue({ fieldId: 'custrecord_lmry_wht_met', value: _met });

                     // if (JSON.stringify(jsonCreditLog) != '{}') {
                     //     wht_log.setValue({ fieldId: 'custrecord_lmry_wht_cre', value: JSON.stringify(jsonCreditLog) });
                     // }

                     // // Graba Log
                     // var logid = wht_log.save();
                     // alogic.push(logid);

                 }
                 console.log(dataLog);
                 objRecord.setValue({ fieldId : "custpage_data_log", value : JSON.stringify(dataLog)});
                 objRecord.setValue({ fieldId : "id_state", value : "1"}); //se cambia de estado
                 //objRecord.setValue({ fieldId: "id_state", value: alogic.toString() });
         }
             // Para poder realizar el siguiente proceso
             return true;

         } catch (msgerr) {
             //alert(msgerr);
             // Envio de mail al clientes
             library.sendMail('LatamReady - WHT ON PAYMENTS CLNT', msgerr);
             handleError("[ saveRecord ]", msgerr);

             return false;
         }
     }

     function validarpayment(scriptContext) {
         var objRecord = scriptContext.currentRecord;
         var row = objRecord.getLineCount({ sublistId: 'custpage_id_sublista' });

         var sw = true;
         for (var i = 0; i < row; i++) {
             var appl = objRecord.getSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_appl', line: i });

             if (appl == true) {
                 var pay = objRecord.getSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_pay', line: i });
                 var amou = objRecord.getSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_amou', line: i });
                 var tran = objRecord.getSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_int', line: i });

                 var desa = '';
                 if ((amou != null && amou != '') && (pay != null && pay != '')) {
                     if (amou < pay) {
                         desa += Mensaje20 + tran + ' , ' + Mensaje21 + pay + ' ' + Mensaje22 + amou + '\n';
                         alert(desa);
                         sw = false;
                     }
                 } else {
                     if (pay == 0 || pay == null || pay == '' || pay < 0) {
                         desa += Mensaje20 + tran + ' , ' + Mensaje23 + ' \n';
                         alert(desa);
                         sw = false;
                     }
                 }
             }
         }
         return sw;
     }

     function markAll() {

         try {
             var objRecord = currentRecord.get();
             var cantidad = objRecord.getLineCount({ sublistId: 'custpage_id_sublista' });

             for (var i = 0; i < cantidad; i++) {
                 var currentLine = objRecord.getSublistField({ sublistId: 'custpage_id_sublista', fieldId: 'id_appl', line: i });

                 if (currentLine.isDisabled == false) {
                     objRecord.selectLine({ sublistId: 'custpage_id_sublista', line: i });
                     var amount_due = objRecord.getCurrentSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_amou' });
                     objRecord.setCurrentSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_appl', value: true });
                     objRecord.setCurrentSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_pay', value: amount_due });
                 }

             }

         } catch (err) {
             library.sendMail('LatamReady - WHT ON PAYMENTS CLNT', err);
             handleError("[ markAll ]", err);
         }

     }

     function desmarkAll() {

         try {
             var objRecord = currentRecord.get();
             var cantidad = objRecord.getLineCount({ sublistId: 'custpage_id_sublista' });

             for (var i = 0; i < cantidad; i++) {
                 objRecord.selectLine({ sublistId: 'custpage_id_sublista', line: i });
                 objRecord.setCurrentSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_appl', value: false });
                 objRecord.setCurrentSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_pay', value: '' });
             }

         } catch (err) {
             library.sendMail('LatamReady - WHT ON PAYMENTS CLNT', err);
             handleError("[ desmarkAll ]", err);
         }

     }


     function fillVendors(context) {
         var recordObj = context.currentRecord;
         var vendorField = recordObj.getField({ fieldId: "custpage_id_payee" });
         if (vendorField) {
             vendorField.removeSelectOption({ value: null });
             vendorField.insertSelectOption({ value: 0, text: "&nbsp;" });
             var subsidiaryId = recordObj.getValue("custpage_id_subsi") || "";
             subsidiaryId = Number(subsidiaryId);

            var btnEl = $("btn_open_search_modal");
            if (btnEl) {
                btnEl.remove();
            }

             if (subsidiaryId) {
                 vendorField.isDisabled = true;

                 var urlReq = "";
                 var licenses = licensesBySubsidiary[subsidiaryId] || [];
                 //Feature : ENABLE SEARCH POPUP
                 var isActiveSearchPopup = library2.getAuthorization(742, licenses);
                 console.log("isActiveSearchPopup",isActiveSearchPopup, licenses);
                 if (!isActiveSearchPopup) {
                     urlReq = url.resolveScript({
                         scriptId: "customscript_lmry_ar_wht_getdata_stlt",
                         deploymentId: "customdeploy_lmry_ar_wht_getdata_stlt",
                         returnExternalUrl: false,
                         params: {
                             type: "full",
                             subsidiaryId: subsidiaryId
                         }
                     });

                 } else {

                     urlReq = url.resolveScript({
                         scriptId: "customscript_lmry_ar_wht_getdata_stlt",
                         deploymentId: "customdeploy_lmry_ar_wht_getdata_stlt",
                         returnExternalUrl: false,
                         params: {
                             type: "paged",
                             start: 0,
                             limit: NUM_VENDORS_LIMIT,
                             subsidiaryId: subsidiaryId
                         }
                     });
                 }
                 var domain = url.resolveDomain({
                     hostType: url.HostType.APPLICATION
                 });

                 urlReq = "https://" + domain + urlReq;
                 console.log(urlReq);
                 makeRequest(urlReq).then(function (response) {
                     if (response) {
                         var numVendors = response.total || 0;
                         if (!isActiveSearchPopup || numVendors < NUM_VENDORS_LIMIT) {
                             var data = response.data;
                             if (data) {
                                 for (var i = 0; i < data.length; i++) {
                                     var id = data[i].id;
                                     var name = data[i].name || data[i].entityId;
                                     vendorField.insertSelectOption({ value: id, text: name });
                                 }
                                 vendorField.isDisabled = false;
                             }
                         } else {
                             createButtonSearchModal();
                         }
                     }
                 }).catch(function (err) {
                     vendorField.isDisabled = false;
                     handleError("[ fillVendors ]", err);
                 });
             } else {
                 vendorField.isDisabled = false;
                 var btnEl = $("btn_open_search_modal");
                 if (btnEl) {
                     btnEl.remove();
                 }
             }
         }

     }

     function fillCurrenciesByVendor(recordObj) {
         var currencyField = recordObj.getField({ fieldId: "custpage_id_curren" });
         if (currencyField) {
             currencyField.removeSelectOption({ value: null });
             currencyField.insertSelectOption({ value: 0, text: "&nbsp;" });
             var vendor = recordObj.getValue({ fieldId: "custpage_id_payee" }) || "";
             vendor = Number(vendor);
             if (vendor) {
                 var vendorQuery = query.create({
                     type: query.Type.VENDOR,
                 });

                 /* Joins */
                 var currencyJoin = vendorQuery.autoJoin({
                     fieldId: 'currencylist',
                 });

                 /* Conditions */
                 vendorQuery.condition =
                     vendorQuery.createCondition({
                         fieldId: 'id',
                         operator: query.Operator.EQUAL,
                         values: [vendor],
                     });

                 /* Columns */
                 vendorQuery.columns = [
                     vendorQuery.createColumn({
                         fieldId: 'companyname',
                     }),
                     vendorQuery.createColumn({
                         fieldId: 'currency',
                         alias: 'primaryCurrencyId',
                     }),
                     vendorQuery.createColumn({
                         fieldId: 'currency',
                         alias: 'primaryCurrencyText',
                         context: query.FieldContext.DISPLAY
                     }),
                     currencyJoin.createColumn({
                         fieldId: 'currency',
                         alias: 'secCurrency',
                     }),
                     currencyJoin.createColumn({
                         fieldId: 'currency',
                         alias: 'secCurrencyText',
                         context: query.FieldContext.DISPLAY
                     })
                 ];

                 var results = vendorQuery.run().asMappedResults();
                 if (results && results.length) {
                     var currencies = {}
                     currencies[results[0].primaryCurrencyId] = results[0].primaryCurrencyText;
                     console.log(currencies);
                     for (var i = 0; i < results.length; i++) {
                         var id = results[i].secCurrency;
                         id = String(id);
                         if (!currencies.hasOwnProperty(id)) {
                             currencies[id] = results[i].secCurrencyText;
                             console.log(currencies);
                         }
                     }

                     for(var id in currencies){
                        currencyField.insertSelectOption({ value: id, text: currencies[id] });
                     }
                 }
             }
         }
     }

     function fillBankAccounts(recordObj) {
         var accountField = recordObj.getField({ fieldId: "custpage_id_bank" });
         if (accountField) {
             accountField.removeSelectOption({ value: null });
             accountField.insertSelectOption({ value: 0, text: "&nbsp;" });
             var currencyId = recordObj.getValue({ fieldId: "custpage_id_curren" }) || "";
             if (currencyId) {
                 var currencies = [currencyId];
                 var subsidiary = "";
                 if (subsi_OW == true || subsi_OW == "T") {
                     subsidiary = recordObj.getValue({ fieldId: "custpage_id_subsi" }) || "";
                     if(Number(subsidiary)){
                        var subsidiaryCurrency = search.lookupFields({
                            type: "subsidiary",
                            id: subsidiary,
                            columns: ["currency"]
                        }).currency || "";

                        if (subsidiaryCurrency && subsidiaryCurrency.length) {
                            subsidiaryCurrency = subsidiaryCurrency[0].value;
                        }

                        if (subsidiaryCurrency && (Number(currencyId) != Number(subsidiaryCurrency))) {
                            currencies.push(subsidiaryCurrency);
                        }
                    }
                 }

                 var accountQuery = query.create({
                     type: "account",
                 });

                 var conditions = [
                     accountQuery.createCondition({
                         fieldId: "accttype",
                         operator: query.Operator.ANY_OF,
                         values: ["Bank","CredCard"]
                     }),
                     accountQuery.createCondition({
                         fieldId: "currency",
                         operator: query.Operator.ANY_OF,
                         values: currencies
                     }),
                     accountQuery.createCondition({
                         fieldId: "isinactive",
                         operator: query.Operator.IS,
                         values: [false]
                     })
                 ];

                 if (subsi_OW == true || subsi_OW == "T") {
                     conditions.push(accountQuery.createCondition({
                         fieldId: "subsidiary",
                         operator: query.Operator.INCLUDE_ANY,
                         values: [subsidiary]
                     }));
                 }
                 accountQuery.condition = accountQuery.and(conditions);
                 accountQuery.columns = [
                     accountQuery.createColumn({
                         fieldId: "id",
                     }),
                     accountQuery.createColumn({
                         fieldId: "displaynamewithhierarchy",
                         alias: "name"
                     })
                 ]

                 var results = accountQuery.run().asMappedResults();
                 for (var i = 0; i < results.length; i++) {
                     var id = results[i]["id"];
                     var name = results[i]["name"];
                     if (id) {
                         accountField.insertSelectOption({ value: id, text: name });
                     }
                 }
             }
         }
     }

     function makeRequest(urlReq, body) {
         body = body || {};
         return new Promise(function (resolve, reject) {
             var xhr = new XMLHttpRequest();
             xhr.open("POST", urlReq);
             xhr.onload = function () {
                 if (this.status >= 200 && this.status < 300) {
                     try {
                         var response = JSON.parse(xhr.response);
                         console.log(response);
                         if (!response.err) {
                             resolve(response);
                         } else {
                             reject(response.err);
                         }
                     } catch (err) {
                         reject(err);
                     }
                 } else {
                     reject({
                         name: "STATUS " + this.status,
                         message: this.statusText
                     });
                 }
             }

             xhr.onerror = function () {
                 reject({
                     name: "STATUS " + this.status,
                     message: this.statusText
                 });
             }

             xhr.send(JSON.stringify(body));
         });
     }

     function handleError(functionName, err) {
         console.error(functionName, err);
         lbryLog.doLog({ title: functionName, message: err, relatedScript: LMRY_script });
         alert(functionName + "\n" + JSON.stringify({ name: err.name, message: err.message }));
     }

     function createButtonSearchModal() {
         var domEl = $('custpage_id_payee_fs');
         if (domEl) {
            //  var btnEl = $("btn_open_search_modal");
            //  if (btnEl) {
            //      btnEl.remove();
            //  }

             btnEl = document.createElement("button");
             btnEl.id = "btn_open_search_modal"
             btnEl.type = "button";
             btnEl.style.marginLeft = "5px";
             btnEl.innerText = Mensaje32;
             btnEl.addEventListener("click", function (evt) {
                 showSearchModal();
             });

             $(domEl).after(btnEl);
         }
     }

     function showSearchModal() {
         Ext.onReady(function () {
             try {
                 var win = Ext.WindowMgr.getActive();
                 if (win) {
                     win.close();
                 }

                 var recordObj = currentRecord.get();
                 var subsidiaryId = recordObj.getValue("custpage_id_subsi") || "";
                 subsidiaryId = Number(subsidiaryId);
                 if (subsidiaryId) {
                     var wsUrl = url.resolveScript({
                         scriptId: "customscript_lmry_ar_wht_getdata_stlt",
                         deploymentId: "customdeploy_lmry_ar_wht_getdata_stlt",
                         returnExternalUrl: false
                     });
                     var domain = url.resolveDomain({
                         hostType: url.HostType.APPLICATION
                     });

                     wsUrl = "https://" + domain + wsUrl;

                     console.log(wsUrl);

                     var store = new Ext.data.JsonStore({
                         // store configs
                         autoDestroy: true,
                         url: wsUrl,
                         remoteSort: false,
                         storeId: 'vendorStore',
                         // reader configs
                         idProperty: 'id',
                         root: 'data',
                         totalProperty: 'total',
                         fields: [{
                             name: 'id'
                         }, {
                             name: 'entityId'
                         }, {
                             name: 'name'
                         }]
                     });

                     store.on("beforeload", function (st, oper) {
                         var vendorName = "";
                         var nameField = Ext.getCmp("field_search_term");
                         if (nameField) {
                             vendorName = nameField.getValue() || "";
                             vendorName = vendorName.trim();
                         }

                         oper.params = Ext.apply(oper.params, { type: "paged", subsidiaryId: subsidiaryId, vendorName: vendorName });
                     });

                     console.log("store created");

                     var grid = new Ext.grid.GridPanel({
                         border: false,
                         region: "center",
                         store: store,
                         colModel: new Ext.grid.ColumnModel({
                             columns: [{
                                 dataIndex: 'id',
                                 header: 'Id',
                                 width: 40
                             }, {
                                 dataIndex: 'entityId',
                                 header: 'Entity ID',
                                 width: 120
                             }, {
                                 dataIndex: 'name',
                                 header: 'Name',
                                 width: 380
                             }],
                             defaults: {
                                 sortable: true
                             }
                         }),
                         stripeRows: true,
                         loadMask: true,
                         sm: new Ext.grid.RowSelectionModel({
                             singleSelect: true,
                             listeners: {
                                 rowselect: function (sm, row, rec) {
                                     if (rec.data) {
                                         var vendorId = rec.data.id;
                                         var vendorName = rec.data.name || "";

                                         var vendorField = recordObj.getField("custpage_id_payee");
                                         if (vendorField) {
                                             vendorField.removeSelectOption({ value: null });
                                             vendorField.insertSelectOption({ value: vendorId, text: vendorName });

                                             recordObj.setValue({ fieldId: "custpage_id_payee", value: vendorId });
                                         }
                                     }

                                     Ext.defer(function () {
                                         Ext.WindowMgr.getActive().close();
                                     }, 100);
                                 }
                             }
                         }),
                         listeners: {
                             render: {
                                 fn: function () {
                                     store.load({
                                         params: {
                                             start: 0,
                                             limit: pageSize
                                         }
                                     });
                                 }
                             }
                         },
                         tbar:
                         {
                             xtype: "toolbar",
                             dock: "top",
                             layout: { type: 'hbox' },
                             style: "background: #E0E6EF; padding-bottom:8px; padding-top:8px;",
                             items: [{
                                 xtype: 'textfield',
                                 id: "field_search_term",
                                 fieldLabel: 'Search',
                                 name: 'search_term',
                                 flex: 67,
                                 height: (Ext.isGecko) ? 26 : 30,
                                 style: "margin-top: 2px; margin-left:7px;"
                             },
                                 "&nbsp;",
                             {
                                 xtype: 'button',
                                 text: Mensaje32,
                                 id: "btn_search",
                                 flex: 23,
                                 style: "background-color: #e1ecf4; border-radius: 4px; border: 1px solid #7aa7c7; box-shadow: rgba(255, 255, 255, .7) 0 1px 0 0 inset; color: #39739d;",
                                 handler: function () {
                                     if (store) {
                                         store.load({
                                             params: {
                                                 start: 0,
                                                 limit: pageSize
                                             }
                                         })
                                     }
                                 }
                             }],
                         },
                         bbar: new Ext.PagingToolbar({
                             store: store,
                             pageSize: pageSize,
                             displayInfo: true,
                             displayMsg: '{0} - {1} of {2}',
                             emptyMsg: "No topics to display"
                         })
                     });

                     console.log("grid created");

                     win = new Ext.Window({
                         title: Mensaje33,
                         width: 580,
                         height: 500,
                         layout: 'border',
                         items: [grid]
                     }).show(null, function () {
                         console.log("window displayed");
                         var searchInputText = $("field_search_term");
                         console.log(searchInputText);
                         if (searchInputText) {
                             searchInputText.classList && searchInputText.classList.remove("x-form-text");
                         }
                     });

                     console.log("window created");
                 }
             } catch (err) {
                handleError("[ showPopup ]", err);
             }
         });
     }

     return {
         pageInit: pageInit,
         fieldChanged: fieldChanged,
         /*postSourcing: postSourcing,
         sublistChanged: sublistChanged,
         lineInit: lineInit,*/
         validateField: validateField,
         funcionCancel: funcionCancel,
         ///validateLine: validateLine,
         /*validateInsert: validateInsert,
         validateDelete: validateDelete,*/
         saveRecord: saveRecord,
         markAll: markAll,
         desmarkAll: desmarkAll
     };

 });
