/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_GeneracionTransactionDIOT_MPRD.js  				  ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Mar 22 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */
define(['N/log', 'N/record', 'N/search', 'N/format', 'N/runtime', 'N/email', './Latam_Library/LMRY_libDIOTLBRY_V2.0', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0',
        './Latam_Library/LMRY_ST_MX_DIOT_LBRY_V2.0'],

  function(log, record, search, format, runtime, email, libraryDIOT, libraryEmail, ST_Library_DIOT) {

    var LMRY_script = 'LatamReady - MX GenerTrans. DIOT MPRD';

    var scriptObj = runtime.getCurrentScript();
    var idLog = scriptObj.getParameter({name: 'custscript_lmry_mx_record_log_id_mprd'});
    var ST_FEATURE = false;

    /**
     * Input Data for processing
     *
     * @return Array,Object,Search,File
     *
     * @since 2016.1
     */
    function getInputData() {

      try{

        log.error('idLog',idLog);

        var logDiot = search.lookupFields({type: 'customrecord_lmry_mx_log_trans_diot', id: idLog,
            columns: ['custrecord_lmry_mx_log_user', 'custrecord_lmry_mx_log_bill_payment_id', 'custrecord_lmry_mx_log_bill_credit_id']
        });

        var user = logDiot.custrecord_lmry_mx_log_user[0].value;
        var billPayments = logDiot.custrecord_lmry_mx_log_bill_payment_id;
        var billCredits = logDiot.custrecord_lmry_mx_log_bill_credit_id;

        var jsonDiot = [];

        if(billPayments){
          billPayments = billPayments.split('|');

          for(var i = 0; i < billPayments.length; i++){
            jsonDiot.push({'id': billPayments[i], 'type': 'vendorpayment', 'user': user});
          }

        }

        if(billCredits){
          billCredits = billCredits.split('|');

          for(var i = 0; i < billCredits.length; i++){
            jsonDiot.push({'id': billCredits[i], 'type': 'vendorcredit', 'user': user});
          }

        }

        return jsonDiot;


      }catch(err){
        log.error('[getInputData]',err);
        libraryEmail.sendemail('[getInputData]' + err, LMRY_script);
      }

    }

    /**
     * If this entry point is used, the map function is invoked one time for each key/value.
     *
     * @param {Object} context
     * @param {boolean} context.isRestarted - Indicates whether the current invocation represents a restart
     * @param {number} context.executionNo - Version of the bundle being installed
     * @param {Iterator} context.errors - This param contains a "iterator().each(parameters)" function
     * @param {string} context.key - The key to be processed during the current invocation
     * @param {string} context.value - The value to be processed during the current invocation
     * @param {function} context.write - This data is passed to the reduce stage
     *
     * @since 2016.1
     */
    function map(context) {

    }

    /**
     * If this entry point is used, the reduce function is invoked one time for
     * each key and list of values provided..
     *
     * @param {Object} context
     * @param {boolean} context.isRestarted - Indicates whether the current invocation represents a restart
     * @param {number} context.executionNo - Version of the bundle being installed
     * @param {Iterator} context.errors - This param contains a "iterator().each(parameters)" function
     * @param {string} context.key - The key to be processed during the current invocation
     * @param {string} context.value - The value to be processed during the current invocation
     * @param {function} context.write - This data is passed to the reduce stage
     *
     * @since 2016.1
     */
    function reduce(context) {

      try{

        var currentTransaction = context.values;
        currentTransaction = JSON.parse(currentTransaction[0]);

        var idTransaction = currentTransaction.id;
        var typeTransaction = currentTransaction.type;
        var user = currentTransaction.user;

        var unprocessedCredits = [];
        var processedCredits = [];

        var loadTransaction = record.load({type: typeTransaction, id: idTransaction, isDynamic: false});

        if(typeTransaction == 'vendorpayment'){
          vendorPayment(loadTransaction, unprocessedCredits);
        }else if(typeTransaction == 'vendorcredit'){
          vendorCredit(loadTransaction, unprocessedCredits, processedCredits);
        }

        var remainingUsage1 = runtime.getCurrentScript().getRemainingUsage();
        log.error('Memoria consumida', remainingUsage1);

        context.write({
          key: user,
          value: {
            processedCredits : processedCredits,
            unprocessedCredits: unprocessedCredits
          }
        });


      }catch(err){

        log.error('reduce',err);
        context.write({key: user, value: {processedCredits : processedCredits, unprocessedCredits: unprocessedCredits, error: idTransaction, type: typeTransaction}});

      }

    }

    /**
     * If this entry point is used, the reduce function is invoked one time for
     * each key and list of values provided..
     *
     * @param {Object} context
     * @param {boolean} context.isRestarted - Indicates whether the current invocation of the represents a restart.
     * @param {number} context.concurrency - The maximum concurrency number when running the map/reduce script.
     * @param {Date} context.datecreated - The time and day when the script began running.
     * @param {number} context.seconds - The total number of seconds that elapsed during the processing of the script.
     * @param {number} context.usage - TThe total number of usage units consumed during the processing of the script.
     * @param {number} context.yields - The total number of yields that occurred during the processing of the script.
     * @param {Object} context.inputSummary - Object that contains data about the input stage.
     * @param {Object} context.mapSummary - Object that contains data about the map stage.
     * @param {Object} context.reduceSummary - Object that contains data about the reduce stage.
     * @param {Iterator} context.ouput - This param contains a "iterator().each(parameters)" function
     *
     * @since 2016.1
     */
    function summarize(context) {

      try{

        var processedCredits = [];
        var unprocessedCredits = [];
        var user = '';
        var error = [];

        context.output.iterator().each(function(key,value){
          var value = JSON.parse(value);

          processedCredits = processedCredits.concat(value.processedCredits);
          unprocessedCredits = unprocessedCredits.concat(value.unprocessedCredits);

          if(value.error){
            error.push({'type': value.type, 'id': value.error});
          }

          user = key;

          return true;

        });

        if(unprocessedCredits.length){
          unprocessedCredits = unprocessedCredits.filter(function (elem, pos) {
              return unprocessedCredits.indexOf(elem) == pos;
          });

          sendEmail(user, unprocessedCredits.join('|'));

        }

        //log.error('error',error);

        var submitValues = {
          'custrecord_lmry_mx_log_credit_unprocess' : (unprocessedCredits.length ? unprocessedCredits.join('|') : ''),
          'custrecord_lmry_mx_log_bill_credit_id' : (processedCredits.length ? processedCredits.join('|') : ''),
          'custrecord_lmry_mx_log_status': (error.length ? '3' : '2'),
          'custrecord_lmry_mx_error': (error.length ? JSON.stringify(error): '')
        };

        record.submitFields({type: 'customrecord_lmry_mx_log_trans_diot', id: idLog, values: submitValues});

      }catch(err){
        log.error('[summarize]', err);
        libraryEmail.sendemail('[summarize]' + err, LMRY_script);
      }


    }

    function vendorPayment(loadTransaction, unprocessedCredits){

      ST_FEATURE = runtime.isFeatureInEffect({ feature: "tax_overhauling" });
      var cLineas = loadTransaction.getLineCount({sublistId: 'apply'});

      for(var i = 0; i < cLineas; i++){
        var apply = loadTransaction.getSublistValue({sublistId: 'apply', fieldId: 'apply', line: i});

        var idBillCredits = [];

        if(apply == 'T' || apply == true){
          var transactionType = loadTransaction.getSublistValue({sublistId: 'apply', fieldId: 'trantype', line: i}).toLowerCase();
          var transactionId = loadTransaction.getSublistValue({sublistId: 'apply', fieldId: 'internalid', line: i});

          if(transactionType == 'vendbill'){
            var loadBill = record.load({type: 'vendorbill', id: transactionId, isDynamic: false});
            if(ST_FEATURE === true || ST_FEATURE === "T") {
              ST_Library_DIOT.CalculoDIOT(loadBill);
            } else {
              libraryDIOT.CalculoDIOT(loadBill);
            }

            var numLineasRelatedRecords = loadBill.getLineCount({sublistId: 'links'});

            for(var j = 0; j < numLineasRelatedRecords; j++){
              var idRelatedRecords = loadBill.getSublistValue({sublistId: 'links', fieldId: 'id', line: j});
              var typeLine = search.lookupFields({type: 'transaction', columns: ['type'], id: idRelatedRecords}).type[0].value;

              if(typeLine == 'VendCred'){
                idBillCredits.push(idRelatedRecords);
              }

            }

            if(idBillCredits.length){
              for(var j = 0; j < idBillCredits.length; j++){
                var loadCredit = record.load({type: 'vendorcredit', id: idBillCredits[j], isDynamic: false});

                var cantLineasApplyActivas = 0;

                var montoCredit = loadCredit.getValue('usertotal');
                var numLineasApply = loadCredit.getLineCount({sublistId: 'apply'});

                for(var k = 0; k < numLineasApply; k++){
                  var applyCredit = loadCredit.getSublistValue({sublistId: 'apply', fieldId: 'apply', line: k});

                  if(applyCredit == true || applyCredit == 'T'){
                    cantLineasApplyActivas++;

                    //var applyCreditID = loadCredit.getSublistValue({sublistId: 'apply', fieldId: 'internalid', line: k});
                    var applyCreditAmount = loadCredit.getSublistValue({sublistId: 'apply', fieldId: 'amount', line: k});

                  }
                }


                if(cantLineasApplyActivas == 1){
                  if(parseFloat(montoCredit) == parseFloat(applyCreditAmount)){
                    if(ST_FEATURE === true || ST_FEATURE === "T") {
                      ST_Library_DIOT.CalculoDIOT(loadCredit);
                    } else {
                      libraryDIOT.CalculoDIOT(loadCredit);
                    }
                  }else{
                    unprocessedCredits.push(idBillCredits[j]);
                  }

                }else{
                  unprocessedCredits.push(idBillCredits[j]);
                }

              }
            }//FIN BILL CREDITS


          }else if(transactionType == 'exprept'){
            var loadExpenseReport = record.load({type: 'expensereport', id: transactionId, isDynamic: false});
            if(ST_FEATURE === true || ST_FEATURE === "T") {
              ST_Library_DIOT.CalculoDIOT(loadExpenseReport);
            } else {
              libraryDIOT.CalculoDIOT(loadExpenseReport);
            }
          }


        }


      }//FIN ITERACION LINEAS BILL PAYMENT

      if(ST_FEATURE === true || ST_FEATURE === "T") {
        ST_Library_DIOT.CalculoDIOT(loadTransaction);
      } else {
        libraryDIOT.CalculoDIOT(loadTransaction);
      }

    }

    function vendorCredit(loadTransaction, unprocessedCredits, processedCredits){

      var montoCredit = loadTransaction.getValue('usertotal');
      var numLineasApply = loadTransaction.getLineCount({sublistId: 'apply'});

      ST_FEATURE = runtime.isFeatureInEffect({ feature: "tax_overhauling" });

      var cantLineasApplyActivas = 0;

      for(var i = 0; i < numLineasApply; i++){
        var applyCredit = loadTransaction.getSublistValue({sublistId: 'apply', fieldId: 'apply', line: i});

        if(applyCredit == true || applyCredit == 'T'){
          cantLineasApplyActivas++;

          var applyCreditID = loadTransaction.getSublistValue({sublistId: 'apply', fieldId: 'internalid', line: i});
          var applyCreditAmount = loadTransaction.getSublistValue({sublistId: 'apply', fieldId: 'amount', line: i});

        }
      }

      if(cantLineasApplyActivas == 1){
        if(parseFloat(montoCredit) == parseFloat(applyCreditAmount)){

          var loadTransactionBill = record.load({type: 'vendorbill', id: applyCreditID, isDynamic: false});
          if(ST_FEATURE === true || ST_FEATURE === "T") {
            ST_Library_DIOT.CalculoDIOT(loadTransactionBill);
            ST_Library_DIOT.CalculoDIOT(loadTransaction);
          } else {
            libraryDIOT.CalculoDIOT(loadTransactionBill);
            libraryDIOT.CalculoDIOT(loadTransaction);
          }

          processedCredits.push(loadTransaction.id);

        }else{
          unprocessedCredits.push(loadTransaction.id);
        }

      }else{
        unprocessedCredits.push(loadTransaction.id);
      }

    }

    function sendEmail(idUser, billCreditError){

      try{

        var idTransactions = billCreditError.split('|');
        var searchTransactions = search.create({type: 'vendorcredit', filters: [['internalid', 'anyof', idTransactions], 'AND',['mainline', 'is', 'T']],
        columns: ['internalid', 'transactionnumber']});

        var results = searchTransactions.run().getRange(0, 1000);

        if(results && results.length) {

            var employee = search.lookupFields({type: 'employee', id: idUser, columns: ['firstname', 'email']});
            var name = employee.firstname;
            var emailAddress = employee.email;

            var htmlList = '';

            for (var i = 0; i < results.length; i++) {
                var num = results[i].getValue('transactionnumber') || '';
                var id = results[i].getValue('internalid');
                htmlList = '<li>Bill Credit ' + num + ' (ID : ' + id + ')</li>';
            }

            var subject = 'NS - Bundle Latinoamerica - DIOT';

            var body = '<body text=\"#333333\" link=\"#014684\" vlink=\"#014684\" alink=\"#014684\">' +
                '    <table width=\"642\" border=\"0\" align=\"center\" cellpadding=\"0\" cellspacing=\"0\">' +
                '        <tbody>' +
                '            <tr>' +
                '                <td width=\"100%\" valign=\"top\"><span class=\"im\">' +
                '                        <table width=\"100%\" border=\"0\" align=\"center\" cellpadding=\"0\" cellspacing=\"0\">' +
                '                            <tbody>' +
                '                                <tr>' +
                '                                    <td width=\"100%\" colspan=\"2\"><img style=\"display:block\"' +
                '                                            src=\"https://ci5.googleusercontent.com/proxy/KKZVvpmT9ElaBmgqPHBxPXvfE0sIO-7i_rO5YjqyBkZItNKw7q35-GVwPRtoK431PtAjtmwGdNTgN1VL4cj-kgf4CjV5ddpDfdCOQ7kNQL5rRZ1oZaGXoYif8yfpP6K0RXFBE8-2ALXvTbj7qe9dEhYSQZatn32Yvb0V=s0-d-e1-ft#https://tstdrv1038915.app.netsuite.com/core/media/media.nl?id=921&amp;c=TSTDRV1038915&amp;h=c493217843d184e7f054\"' +
                '                                            width=\"645\" alt=\"main banner\" class=\"CToWUd a6T\" tabindex=\"0\">' +
                '                                        <div class=\"a6S\" dir=\"ltr\" style=\"opacity: 0.01; left: 834.2px; top: 67px;\">' +
                '                                            <div id=\":uf\" class=\"T-I J-J5-Ji aQv T-I-ax7 L3 a5q\" role=\"button\"' +
                '                                                tabindex=\"0\" aria-label=\"Download attachment \" data-tooltip-class=\"a1V\"' +
                '                                                data-tooltip=\"Download\">' +
                '                                                <div class=\"aSK J-J5-Ji aYr\"></div>' +
                '                                            </div>' +
                '                                        </div>' +
                '                                    </td>' +
                '                                </tr>' +
                '                            </tbody>' +
                '                        </table>' +
                '                        <table width=\"100%\" border=\"0\" align=\"center\" cellpadding=\"0\" cellspacing=\"0\">' +
                '                            <tbody>' +
                '                                <tr>' +
                '                                    <td bgcolor=\"#d50303\" width=\"15%\">&nbsp;</td>' +
                '                                    <td bgcolor=\"#d50303\" width=\"85%\">' +
                '                                        <font' +
                '                                            style=\"color:#ffffff;line-height:130%;font-family:Arial,Helvetica,sans-serif;font-size:19px\">' +
                '                                            Estimado(a) ' + name + '<br></font>' +
                '                                    </td>' +
                '                                </tr>' +
                '                                <tr>' +
                '                                    <td width=\"100%\" bgcolor=\"#d50303\" colspan=\"2\" align=\"right\"><a' +
                '                                            href=\"http://www.latamready.com/#contac\" target=\"_blank\"' +
                '                                            data-saferedirecturl=\"https://www.google.com/url?q=http://www.latamready.com/%23contac&amp;source=gmail&amp;ust=1565404428180000&amp;usg=AFQjCNGer5iEt3Kgy7oa0vuVMdUJs9ni0g\"><img' +
                '                                                src=\"https://ci3.googleusercontent.com/proxy/3q8l-tZWn5ql0fr7Yb9FWKy60Imrd8I7fDnwNPo_IujC4uEBATpLNW78o8tBbcxPiFbOhtPOVyZGKmnRoOKyAOZ29pGJl1rdK3ESvwMT8tDhUYwlYDgJhZ2VZrF8DgtghOS28rHdqhVTarGSsnuINUDOSuxTS4-cg0pR=s0-d-e1-ft#https://tstdrv1038915.app.netsuite.com/core/media/media.nl?id=923&amp;c=TSTDRV1038915&amp;h=3c7406d759735a1e791d\"' +
                '                                                width=\"94\" style=\"margin-right:45px\" class=\"CToWUd\"></a></td>' +
                '                                </tr>' +
                '                                <tr>' +
                '                                    <td width=\"100%\" bgcolor=\"#FFF\" colspan=\"2\" align=\"right\"><a' +
                '                                            href=\"https://www.linkedin.com/company/9207808\" target=\"_blank\"' +
                '                                            data-saferedirecturl=\"https://www.google.com/url?q=https://www.linkedin.com/company/9207808&amp;source=gmail&amp;ust=1565404428181000&amp;usg=AFQjCNFv5LPl5xhD4m6AxO8nFwU484XBig\"><img' +
                '                                                src=\"https://ci3.googleusercontent.com/proxy/2VC_71_nAioDH4UBvOZXVsXy2g-EouVn473kmu4NT0cpX3kcd4CexD91SDETvvpOZvF0gAkNJSQTJ2rEQD_ok5g3gV2NgcPqp7pwMNDgl9UK4NPaqrUktkdjl9SyBm8NEzie_0Pj0RRgaEagk0FBbHQ0qNSl8yHC5gTu=s0-d-e1-ft#https://tstdrv1038915.app.netsuite.com/core/media/media.nl?id=924&amp;c=TSTDRV1038915&amp;h=c135e74bcb8d5e1ac356\"' +
                '                                                width=\"15\" style=\"margin:5px 1px 5px 0px\" class=\"CToWUd\"></a><a' +
                '                                            href=\"https://www.facebook.com/LatamReady-337412836443120/\" target=\"_blank\"' +
                '                                            data-saferedirecturl=\"https://www.google.com/url?q=https://www.facebook.com/LatamReady-337412836443120/&amp;source=gmail&amp;ust=1565404428181000&amp;usg=AFQjCNF-s20Q4L0JQ69OLmeXi-tYNbQupQ\"><img' +
                '                                                src=\"https://ci4.googleusercontent.com/proxy/5lT5DpelGRs7k1YSzQnyR3O-rC_RtlBDqzPGyIs4J08bT1AFFzDvD6klseQZmcEydlmlfT0coEo4ynW0NWl_CkuE1-Vqa_jPnnaAAkyETkJeF79UuqleG0mcfL06sHSSxO3g-wGpnXlwtOE5pyUXPTMfhNmiQ__CAjl4=s0-d-e1-ft#https://tstdrv1038915.app.netsuite.com/core/media/media.nl?id=919&amp;c=TSTDRV1038915&amp;h=9c937774d04fb76747f7\"' +
                '                                                width=\"15\" style=\"margin:5px 1px 5px 0px\" class=\"CToWUd\"></a><a' +
                '                                            href=\"https://twitter.com/LatamReady\" target=\"_blank\"' +
                '                                            data-saferedirecturl=\"https://www.google.com/url?q=https://twitter.com/LatamReady&amp;source=gmail&amp;ust=1565404428181000&amp;usg=AFQjCNFaSZ0vX3IQzFTrT09SVNCeDvrYng\"><img' +
                '                                                src=\"https://ci6.googleusercontent.com/proxy/NXf6ovS7TBKj8_yiGRFJfDKnJfQJPtVTKQs4QBAJvfCrX-MrKayXJdaxk5CHJv2VAqr-l9IncG-9ZFSiherERVu8qxy6F7BR79bzEWFs9UH2ty4T855P-qcqCp3nn-QRG5lL9viqDgyrhl3ub9ATAl4XXpNDy-4rVp5Y=s0-d-e1-ft#https://tstdrv1038915.app.netsuite.com/core/media/media.nl?id=928&amp;c=TSTDRV1038915&amp;h=fc69b39a8e7210c65984\"' +
                '                                                width=\"15\" style=\"margin:5px 47px 5px 0px\" class=\"CToWUd\"></a></td>' +
                '                                </tr>' +
                '                            </tbody>' +
                '                        </table>' +
                '                    </span>' +
                '                    <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"2\">' +
                '                        <tbody>' +
                '                            <tr>' +
                '                                <td width=\"15%\">&nbsp;</td>' +
                '                                <td width=\"70%\">' +
                '                                    <font' +
                '                                        style=\"color:#333333;line-height:200%;font-family:Trebuchet MS,Helvetica,sans-serif;font-size:13px\">' +
                '                                        <span class=\"im\">' +
                '                                            <p>Este es un mensaje de error automático de LatamReady SuiteApp.</p>' +
                '                                            <p>El detalle es el siguiente:</p>' +
                '                                        </span>' +
                '                                        <p style=\"text-align:Left;font-size:9pt;font-weight:bold;\">' +
                '                                            Transacciones que fallaron el proceso de la DIOT:' +
                '                                        </p>' +
                '                                        <ul style=\"text-align:Left;font-size:9pt;font-weight:bold;\">' +
                htmlList +
                '                                        </ul>' +
                '                                        <div>' +
                '                                            <div class=\"adm\">' +
                '                                                <div id=\"q_3\" class=\"ajR h4\" data-tooltip=\"Hide expanded content\"' +
                '                                                    aria-label=\"Hide expanded content\" aria-expanded=\"true\">' +
                '                                                    <div class=\"ajT\"></div>' +
                '                                                </div>' +
                '                                            </div>' +
                '                                            <div class=\"im\">' +
                '                                                <p>Saludos,</p>' +
                '                                                <p>El Equipo de LatamReady</p>' +
                '                                            </div>' +
                '                                        </div>' +
                '                                    </font>' +
                '                                </td>' +
                '                                <td width=\"15%\">&nbsp;</td>' +
                '                            </tr>' +
                '                        </tbody>' +
                '                    </table>' +
                '                    <div>' +
                '                        <div class=\"adm\">' +
                '                            <div id=\"q_1\" class=\"ajR h4\">' +
                '                                <div class=\"ajT\"></div>' +
                '                            </div>' +
                '                        </div>' +
                '                        <div class=\"h5\"><br>' +
                '                            <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"2\" bgcolor=\"#e5e6e7\">' +
                '                                <tbody>' +
                '                                    <tr>' +
                '                                        <td>&nbsp;</td>' +
                '                                    </tr>' +
                '                                    <tr>' +
                '                                        <td width=\"15%\">&nbsp;</td>' +
                '                                        <td width=\"70%\" align=\"center\">' +
                '                                            <font' +
                '                                                style=\"color:#333333;line-height:200%;font-family:Trebuchet MS,Helvetica,sans-serif;font-size:12px\">' +
                '                                                <i>Este es un mensaje automático. Por favor, no responda este correo' +
                '                                                    electrónico.</i></font>' +
                '                                        </td>' +
                '                                        <td width=\"15%\">&nbsp;</td>' +
                '                                    </tr>' +
                '                                    <tr>' +
                '                                        <td>&nbsp;</td>' +
                '                                    </tr>' +
                '                                </tbody>' +
                '                            </table>' +
                '                            <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"2\">' +
                '                                <tbody>' +
                '                                    <tr>' +
                '                                        <td width=\"15%\">&nbsp;</td>' +
                '                                        <td width=\"70%\" align=\"center\"><a href=\"http://www.latamready.com/\"' +
                '                                                target=\"_blank\"' +
                '                                                data-saferedirecturl=\"https://www.google.com/url?q=http://www.latamready.com/&amp;source=gmail&amp;ust=1565404428181000&amp;usg=AFQjCNGNPcRfZ1dpjvnWo2fUS7fxO5VkLQ\"><img' +
                '                                                    src=\"https://ci4.googleusercontent.com/proxy/ZZKP5V-yCU2KPwocx8oaMKlt84Dk8Gmm9778RxqfDN8HBH7rTZJCh-Rv1cS_1nEu6ILWlSxX0CAQhbO9-tMXOG0WjyQjYFwfYe_UfFQUJPeMoe4WJHLdz5viHuRpDpuOpuulSjSe8-a5z2EdL7plTZtBzabFutJXtZjj=s0-d-e1-ft#https://tstdrv1038915.app.netsuite.com/core/media/media.nl?id=926&amp;c=TSTDRV1038915&amp;h=e14f0c301f279780eb38\"' +
                '                                                    width=\"169\" style=\"margin:15px 0px 15px 0px\" class=\"CToWUd\"></a>' +
                '                                        </td>' +
                '                                        <td width=\"15%\">&nbsp;</td>' +
                '                                    </tr>' +
                '                                </tbody>' +
                '                            </table>' +
                '                            <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"2\">' +
                '                                <tbody>' +
                '                                    <tr>' +
                '                                        <td width=\"15%\">&nbsp;</td>' +
                '                                        <td width=\"70%\" align=\"center\"><a' +
                '                                                href=\"https://www.linkedin.com/company/9207808\" target=\"_blank\"' +
                '                                                data-saferedirecturl=\"https://www.google.com/url?q=https://www.linkedin.com/company/9207808&amp;source=gmail&amp;ust=1565404428181000&amp;usg=AFQjCNFv5LPl5xhD4m6AxO8nFwU484XBig\"><img' +
                '                                                    src=\"https://ci5.googleusercontent.com/proxy/3HjfS2IdCh8wHFLMwM7aTQ5JSDUD9IgNqkwFxotl8IN3e5b5aguB3myYd8MEMTBvTbetkhw5lncgBv_3R0melvD_lvesdSARJI9_mdpLSImey4ltHesM3JAVi4NxsyN3b7gd3AOCje0wCIcfiM4UhGp803DInZZFZIGo=s0-d-e1-ft#https://tstdrv1038915.app.netsuite.com/core/media/media.nl?id=925&amp;c=TSTDRV1038915&amp;h=41ec53b63dba135488be\"' +
                '                                                    width=\"101\" style=\"margin:0px 5px 0px 5px\" class=\"CToWUd\"></a><a' +
                '                                                href=\"https://www.facebook.com/LatamReady-337412836443120/\"' +
                '                                                target=\"_blank\"' +
                '                                                data-saferedirecturl=\"https://www.google.com/url?q=https://www.facebook.com/LatamReady-337412836443120/&amp;source=gmail&amp;ust=1565404428181000&amp;usg=AFQjCNF-s20Q4L0JQ69OLmeXi-tYNbQupQ\"><img' +
                '                                                    src=\"https://ci4.googleusercontent.com/proxy/sXaLRbldK0_Ovmrf3eMiGZalp3-J4EL_g269fiKZj-lPNy3u0sGjBuR16QXp5RuDIY7lmGbtNB1wOd3dVU8f0Rk3LHpHElEWNUS6m_QyQpZj0Af1fZburhC3dyTMCUroscxBaiZl5Cd69PhYAjuprZ8bCBu22X0GRJdO=s0-d-e1-ft#https://tstdrv1038915.app.netsuite.com/core/media/media.nl?id=920&amp;c=TSTDRV1038915&amp;h=7fb4d03fff9283e55318\"' +
                '                                                    width=\"101\" style=\"margin:0px 5px 0px 5px\" class=\"CToWUd\"></a><a' +
                '                                                href=\"https://twitter.com/LatamReady\" target=\"_blank\"' +
                '                                                data-saferedirecturl=\"https://www.google.com/url?q=https://twitter.com/LatamReady&amp;source=gmail&amp;ust=1565404428181000&amp;usg=AFQjCNFaSZ0vX3IQzFTrT09SVNCeDvrYng\"><img' +
                '                                                    src=\"https://ci3.googleusercontent.com/proxy/eXiz1tDcS_fPqwiM4xWtnCyg69zq6Wx2AbYWvZPeicV39LbW5cfyvk-neFmdkXLhU7fTwpFuaTDw_zc6oli64suLnYEMdnCl7XumVLDtiyu02GHUWo5KOWxWp0RRLTfjVaiLEOL9wXIZNSPo_W5Jv0IoGM1IJ_0WBVms=s0-d-e1-ft#https://tstdrv1038915.app.netsuite.com/core/media/media.nl?id=929&amp;c=TSTDRV1038915&amp;h=300c376863035d25c42a\"' +
                '                                                    width=\"101\" style=\"margin:0px 5px 0px 5px\" class=\"CToWUd\"></a></td>' +
                '                                        <td width=\"15%\">&nbsp;</td>' +
                '                                    </tr>' +
                '                                </tbody>' +
                '                            </table>' +
                '                            <table width=\"100%\" border=\"0\" cellspacing=\"0\">' +
                '                                <tbody>' +
                '                                    <tr>' +
                '                                        <td><img src=\"https://ci6.googleusercontent.com/proxy/0g6Ehlmct9xlXo4kprMDgM8UDmcMDtXd0tMzJ2pIPrl-aKlPqu2x0RbFURgg9CCPAIgvEfatgqRG8qjCGXCdpNaRkuAoJ_F_h2kHg4KKC0X5OLvkRi7dBE3-Nv1oWwuNzs0hl58f37hosFczaQ7apcryestAW6XQ9G_B=s0-d-e1-ft#https://tstdrv1038915.app.netsuite.com/core/media/media.nl?id=918&amp;c=TSTDRV1038915&amp;h=7f0198f888bdbb495497\"' +
                '                                                width=\"642\" style=\"margin:15px 0px 15px 0px\" class=\"CToWUd a6T\"' +
                '                                                tabindex=\"0\">' +
                '                                            <div class=\"a6S\" dir=\"ltr\" style=\"opacity: 0.01; left: -8px; top: -8px;\">' +
                '                                                <div id=\":ug\" class=\"T-I J-J5-Ji aQv T-I-ax7 L3 a5q\" title=\"Download\"' +
                '                                                    role=\"button\" tabindex=\"0\" aria-label=\"Download attachment \"' +
                '                                                    data-tooltip-class=\"a1V\">' +
                '                                                    <div class=\"aSK J-J5-Ji aYr\"></div>' +
                '                                                </div>' +
                '                                            </div>' +
                '                                        </td>' +
                '                                    </tr>' +
                '                                </tbody>' +
                '                            </table>' +
                '                        </div>' +
                '                    </div>' +
                '                </td>' +
                '            </tr>' +
                '        </tbody>' +
                '    </table>' +
                '</body>';


            email.send({author: idUser, recipients: emailAddress, subject: subject, body: body});
        }

      }catch(err){
        log.error('sendEmail',err);
        libraryEmail.sendemail(' [ sendEmail ] ' + err, LMRY_script);
      }


    }

    return {
      getInputData: getInputData,
      //map: map,
      reduce: reduce,
      summarize: summarize
    };

  });
