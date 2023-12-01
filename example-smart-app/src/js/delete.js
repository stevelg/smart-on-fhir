$(document).on("click", ".btn.btn-outline-danger", function () {
  var medicationOrderId = this.id; // The id of the button is the MedicationOrder resource id

  // Show the loading overlay
  $("#loadingOverlay").show();

  smartClient.patient.api
    .delete({
      type: "MedicationOrder",
      id: medicationOrderId,
    })
    .then(
      function (response) {
        // The medication order was successfully deleted
        console.log("Medication order deleted:", response);

        // Remove the row from the table
        $("#" + medicationOrderId)
          .closest("tr")
          .remove();

        // Hide the loading overlay
        $("#loadingOverlay").hide();
      },
      function (error) {
        // An error occurred
        console.error("Error deleting medication order:", error);
        $("#loadingOverlay").hide();
      }
    );
});
